import re
from typing import List, Dict, Any, Tuple
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


def parse_spec_text_or_blocks(text_content: str) -> Tuple[List[ValveItem], Dict[str, Any]]:
    """
    Parses unstructured text, numbered lists, and datasheet bullet points.
    """
    items: List[ValveItem] = []
    root_specs: Dict[str, Any] = {}

    # Extract common engineering specs from the full document
    root_moc = normalize_material(text_content)
    root_ends = normalize_end_connection(text_content)
    if root_moc:
        root_specs['valve_moc_body'] = root_moc
    if root_ends:
        root_specs['valve_end_connection'] = root_ends

    lines = [line.strip() for line in text_content.split('\n') if line.strip()]

    # Patterns for line items
    # e.g. "1. 50 NB Class 150 Ball Valve (Qty: 10 Nos)"
    # or "- 2" 150# Gate Valve - 5 Nos"
    item_pattern = re.compile(
        r'^\s*(?:(?:item|sr|sl|line)?\s*[\d]{1,3}\s*[:.)-]?|[-*•])\s*(.+?)(?:[-–:,]\s*|\s+)(?:(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:\s=-]*(\d+)|(\d+)\s*(?:nos|qty|quantity|numbers?|pcs|sets?|ea|each)[.:]?|\(?\s*(?:qty|quantity)\s*[:=–-]?\s*(\d+)\s*(?:nos|pcs|ea|sets?)?\s*\)?)\s*$',
        re.I
    )

    current_idx = 1
    for line in lines:
        match = item_pattern.match(line)
        if match:
            desc = match.group(1).strip()
            qty_raw = match.group(2) or match.group(3) or match.group(4) or '1'
            try:
                qty = int(qty_raw)
            except ValueError:
                qty = 1

            v_type = normalize_valve_type(desc)
            v_size = normalize_size(desc)
            v_class = normalize_class(desc)
            v_moc = normalize_material(desc) or root_moc
            v_ends = normalize_end_connection(desc) or root_ends
            v_op = normalize_operation(desc)

            if v_type or (v_size and v_class) or (v_size and qty > 0):
                items.append(ValveItem(
                    item_no=current_idx,
                    description=desc,
                    valve_type=v_type or "Ball Valve",
                    valve_size=v_size,
                    valve_class=v_class,
                    quantity=qty,
                    unit="NOS",
                    valve_moc_body=v_moc,
                    valve_end_connection=v_ends,
                    valve_operating=v_op,
                    confidence=0.95,
                    provenance="PYTHON_SPEC_SHEET"
                ))
                current_idx += 1

    return items, root_specs


def parse_pdf_blocks(file_bytes: bytes) -> Tuple[List[ValveItem], Dict[str, Any]]:
    """
    Uses PyMuPDF layout blocks to reconstruct multi-column reading order.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = ""

    for page in doc:
        blocks = page.get_text("blocks")
        # Sort blocks top-to-bottom, left-to-right
        sorted_blocks = sorted(blocks, key=lambda b: (round(b[1] / 10) * 10, b[0]))
        for b in sorted_blocks:
            block_text = b[4].strip()
            if block_text:
                full_text += f"\n{block_text}"

    return parse_spec_text_or_blocks(full_text)
