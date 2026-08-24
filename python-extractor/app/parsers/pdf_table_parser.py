import io
import re
from typing import List, Dict, Any, Tuple, Optional
import pdfplumber
import pymupdf as fitz

from app.schemas import ValveItem
from app.parsers.dictionary import (
    normalize_valve_type,
    normalize_size,
    normalize_class,
    normalize_material,
    normalize_end_connection,
    normalize_operation
)


def parse_pdf_tables(file_bytes: bytes) -> Tuple[List[ValveItem], Dict[str, Any]]:
    """
    Extracts structured valve line items from PDF tabular layouts.
    Uses pdfplumber for table coordinate extraction and PyMuPDF for block context.
    """
    items: List[ValveItem] = []
    root_specs: Dict[str, Any] = {}

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            full_doc_text = ""
            current_item_idx = 1

            for page_idx, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                full_doc_text += f"\n{page_text}"

                # Extract tables with explicit table settings
                tables = page.extract_tables({
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "snap_tolerance": 3,
                    "join_tolerance": 3
                }) or page.extract_tables({
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text"
                })

                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    # Header detection
                    header_row_idx = -1
                    col_map: Dict[str, int] = {}

                    for r_idx, row in enumerate(table[:3]):
                        clean_row = [str(c or '').lower().strip() for c in row]
                        # Check if this row looks like a header
                        for c_idx, cell in enumerate(clean_row):
                            if re.search(r'\b(sr|sl|item|s\.no|no\.?)\b', cell):
                                col_map['sr'] = c_idx
                            elif re.search(r'\b(desc|description|particular|item\s+name|item\s+details)\b', cell):
                                col_map['desc'] = c_idx
                            elif re.search(r'\b(size|dn|nb|nps|dia)\b', cell):
                                col_map['size'] = c_idx
                            elif re.search(r'\b(class|rating|pressure)\b', cell):
                                col_map['class'] = c_idx
                            elif re.search(r'\b(qty|quantity|nos|qnty)\b', cell):
                                col_map['qty'] = c_idx
                            elif re.search(r'\b(unit|uom)\b', cell):
                                col_map['unit'] = c_idx
                            elif re.search(r'\b(moc|material|body\s+material)\b', cell):
                                col_map['moc'] = c_idx
                            elif re.search(r'\b(end|connection|ends)\b', cell):
                                col_map['ends'] = c_idx
                            elif re.search(r'\b(tag|tag\s+no)\b', cell):
                                col_map['tag'] = c_idx

                        if 'desc' in col_map or ('size' in col_map and 'qty' in col_map):
                            header_row_idx = r_idx
                            break

                    if header_row_idx == -1:
                        # No clear header, check if single wide description column exists
                        continue

                    # Process data rows
                    for row in table[header_row_idx + 1:]:
                        if not row or all(not (c or '').strip() for c in row):
                            continue

                        desc_val = str(row[col_map['desc']]).strip() if 'desc' in col_map and col_map['desc'] < len(row) and row[col_map['desc']] else ''
                        size_val = str(row[col_map['size']]).strip() if 'size' in col_map and col_map['size'] < len(row) and row[col_map['size']] else ''
                        class_val = str(row[col_map['class']]).strip() if 'class' in col_map and col_map['class'] < len(row) and row[col_map['class']] else ''
                        qty_val_raw = str(row[col_map['qty']]).strip() if 'qty' in col_map and col_map['qty'] < len(row) and row[col_map['qty']] else '1'
                        unit_val = str(row[col_map['unit']]).strip() if 'unit' in col_map and col_map['unit'] < len(row) and row[col_map['unit']] else 'NOS'
                        moc_val = str(row[col_map['moc']]).strip() if 'moc' in col_map and col_map['moc'] < len(row) and row[col_map['moc']] else ''
                        ends_val = str(row[col_map['ends']]).strip() if 'ends' in col_map and col_map['ends'] < len(row) and row[col_map['ends']] else ''
                        tag_val = str(row[col_map['tag']]).strip() if 'tag' in col_map and col_map['tag'] < len(row) and row[col_map['tag']] else None

                        # Combine row text if desc is sparse
                        combined_row_text = " ".join([str(c or '').strip() for c in row if c])
                        full_item_desc = desc_val or combined_row_text

                        # Skip non-product or summary rows
                        if re.search(r'\b(total|grand\s+total|subtotal|notes?|terms)\b', full_item_desc, re.I):
                            continue

                        # Parse quantity
                        qty_clean = 1
                        qty_match = re.search(r'\b(\d+)\b', qty_val_raw)
                        if qty_match:
                            try:
                                qty_clean = int(qty_match.group(1))
                            except ValueError:
                                qty_clean = 1

                        # Normalize attributes
                        v_type = normalize_valve_type(full_item_desc) or normalize_valve_type(combined_row_text)
                        v_size = normalize_size(size_val) or normalize_size(full_item_desc)
                        v_class = normalize_class(class_val) or normalize_class(full_item_desc)
                        v_moc = normalize_material(moc_val) or normalize_material(full_item_desc)
                        v_ends = normalize_end_connection(ends_val) or normalize_end_connection(full_item_desc)
                        v_op = normalize_operation(full_item_desc)

                        # Only add if has valve type or valid size/class
                        if v_type or (v_size and v_class) or (v_size and qty_clean > 0):
                            items.append(ValveItem(
                                item_no=current_item_idx,
                                description=full_item_desc,
                                valve_type=v_type or "Ball Valve",
                                valve_size=v_size,
                                valve_class=v_class,
                                quantity=qty_clean,
                                unit=unit_val.upper() if unit_val else "NOS",
                                valve_moc_body=v_moc,
                                valve_end_connection=v_ends,
                                valve_operating=v_op,
                                tag_number=tag_val,
                                confidence=0.95,
                                provenance="PYTHON_PDF_TABLE"
                            ))
                            current_item_idx += 1

            # Extract Document-Level Root Specs from full text
            root_moc = normalize_material(full_doc_text)
            root_ends = normalize_end_connection(full_doc_text)
            if root_moc:
                root_specs['valve_moc_body'] = root_moc
            if root_ends:
                root_specs['valve_end_connection'] = root_ends

            # Inherit common specs to line items that missed them
            for item in items:
                if not item.valve_moc_body and root_moc:
                    item.valve_moc_body = root_moc
                if not item.valve_end_connection and root_ends:
                    item.valve_end_connection = root_ends

    except Exception as err:
        print(f"[Python PDF Table Parser] Error: {err}")

    return items, root_specs
