import io
import unittest
from openpyxl import Workbook
from pypdf import PdfWriter
from parse import DocumentError, parse_document


class ParsingTests(unittest.TestCase):
    def test_utf8_bilingual_lines_and_csv_cells(self):
        lines = parse_document('报价.txt', '供应商：甲\n\n每箱24件'.encode())
        self.assertEqual(lines[1], {'id': 'L2', 'locator': 'line 3', 'text': '每箱24件'})
        self.assertEqual(parse_document('quote.csv', b'SKU,Price,Pack\nM1,48,24')[1]['text'], 'M1 | 48 | 24')

    def test_xlsx_formula_and_source_locations(self):
        book = Workbook(); sheet = book.active; sheet.title = 'Supplier'
        sheet.append(['SKU', 'USD/pack']); sheet.append(['M1', 48])
        data = io.BytesIO(); book.save(data)
        self.assertEqual(parse_document('q.xlsx', data.getvalue())[1]['locator'], 'Supplier / row 2')
        sheet['B2'] = '=1+2'; data = io.BytesIO(); book.save(data)
        with self.assertRaisesRegex(DocumentError, 'spreadsheet_formula_requires_values'):
            parse_document('q.xlsx', data.getvalue())

    def test_scan_and_limits_are_explicit_failures(self):
        writer = PdfWriter(); writer.add_blank_page(width=200, height=200); data = io.BytesIO(); writer.write(data)
        with self.assertRaisesRegex(DocumentError, 'scanned_pdf_needs_ocr'):
            parse_document('scan.pdf', data.getvalue())
        with self.assertRaisesRegex(DocumentError, 'document_too_complex'):
            parse_document('long.txt', b'x\n' * 241)
        with self.assertRaisesRegex(DocumentError, 'file_too_large'):
            parse_document('big.txt', b'x' * 512001)

    def test_plain_email_body_only(self):
        content = b'From: supplier@example.test\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nUSD 4 per piece'
        self.assertEqual(parse_document('quote.eml', content)[0]['text'], 'USD 4 per piece')


if __name__ == '__main__':
    unittest.main()
