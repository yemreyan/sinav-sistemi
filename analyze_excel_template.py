import openpyxl
import sys

file_path = "Sınav Sonuç Değerlendirme exc new (2).xlsx"

try:
    wb = openpyxl.load_workbook(file_path, data_only=False)
    sheet = wb.active
    print(f"Active Sheet: {sheet.title}")

    # Inspect the first 20 rows and 15 columns
    print("\n--- CELL CONTENT (First 20x15) ---")
    rows = list(sheet.iter_rows(min_row=1, max_row=20, min_col=1, max_col=15))
    
    # Header check
    header = [str(cell.value) if cell.value else "" for cell in rows[0]]
    print(f"Header: {header}")

    for i, row in enumerate(rows):
        row_data = []
        for cell in row:
            val = ""
            if cell.value:
                val = str(cell.value)
                # Check if formula (openpyxl might show formula as string starting with =)
                if isinstance(cell.value, str) and cell.value.startswith('='):
                    val = f"FORMULA: {cell.value}"
            row_data.append(val)
        print(f"Row {i+1}: {row_data}")

    # Check merged cells to understand "card" structure
    print("\n--- MERGED CELLS ---")
    for merge in list(sheet.merged_cells.ranges)[:10]: # First 10 merges
        print(merge)

except Exception as e:
    print(f"Error: {e}")
