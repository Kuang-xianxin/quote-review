"""Bounded source parsing. Locators always describe the supplied document."""
import csv
import io
import zipfile
from email import policy
from email.parser import BytesParser


class DocumentError(Exception):
    pass


def parse_document(filename: str, content: bytes) -> list[dict]:
    if not content or len(content) > 512_000:
        raise DocumentError("file_too_large")
    output = []
    total = 0

    def add(text, locator):
        nonlocal total
        text = str(text).strip()
        if not text:
            return
        total += len(text)
        if len(output) >= 240 or len(text) > 1600 or total > 14000:
            raise DocumentError("document_too_complex")
        output.append({"id": f"L{len(output)+1}", "locator": locator, "text": text})

    extension = filename.lower().rsplit(".", 1)[-1]
    if extension == "pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise DocumentError("encrypted_pdf")
        if len(reader.pages) > 10:
            raise DocumentError("too_many_pages")
        for page, item in enumerate(reader.pages, 1):
            for line, text in enumerate((item.extract_text() or "").splitlines(), 1):
                add(text, f"p.{page} / line {line}")
        if not output:
            raise DocumentError("scanned_pdf_needs_ocr")
    elif extension == "xlsx":
        from openpyxl import load_workbook
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            if sum(item.file_size for item in archive.infolist()) > 8_000_000:
                raise DocumentError("spreadsheet_too_large")
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=False, keep_links=False)
        try:
            if len(workbook.worksheets) > 5:
                raise DocumentError("too_many_sheets")
            for sheet in workbook.worksheets:
                if sheet.max_row > 250 or sheet.max_column > 30:
                    raise DocumentError("spreadsheet_too_large")
                for row_number, row in enumerate(sheet.iter_rows(), 1):
                    if any(cell.data_type == "f" for cell in row):
                        raise DocumentError("spreadsheet_formula_requires_values")
                    add(" | ".join(str(cell.value) if cell.value is not None else "" for cell in row), f"{sheet.title} / row {row_number}")
        finally:
            workbook.close()
    elif extension in ("txt", "csv", "eml"):
        if extension == "eml":
            message = BytesParser(policy=policy.default).parsebytes(content)
            part = message.get_body(preferencelist=("plain",)) if message.is_multipart() else message
            if not part or part.get_content_type() != "text/plain":
                raise DocumentError("email_plaintext_required")
            text = part.get_content()
        else:
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError as error:
                raise DocumentError("utf8_required") from error
        if extension == "csv":
            try:
                dialect = csv.Sniffer().sniff(text[:2048], delimiters=",;\t")
            except csv.Error:
                dialect = csv.excel
            for number, row in enumerate(csv.reader(io.StringIO(text), dialect), 1):
                if len(row) > 30:
                    raise DocumentError("spreadsheet_too_large")
                add(" | ".join(row), f"row {number}")
        else:
            for number, line in enumerate(text.splitlines(), 1):
                add(line, f"line {number}")
    else:
        raise DocumentError("unsupported_file")
    if not output:
        raise DocumentError("empty_document")
    return output
