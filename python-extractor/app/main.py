import io
import os
import sys
import openpyxl

# Ensure project root is in sys.path when run directly
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.schemas import ExtractionResponse, ValveItem
from app.parsers.pdf_table_parser import parse_pdf_tables
from app.parsers.spec_sheet_parser import parse_pdf_blocks, parse_spec_text_or_blocks
from app.parsers.dictionary import (
    normalize_valve_type,
    normalize_size,
    normalize_class,
    normalize_material,
    normalize_end_connection,
    normalize_operation
)

app = FastAPI(
    title="Petro Valves Document Extraction Microservice",
    version="1.0.0",
    description="High-precision Python extraction service for complex PDFs, BOQs, and specification sheets"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextExtractionRequest(BaseModel):
    text: str


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "petro-valves-python-extractor",
        "version": "1.0.0"
    }


@app.post("/api/v1/extract-text", response_model=ExtractionResponse)
def extract_text(request: TextExtractionRequest):
    if not request.text:
        return ExtractionResponse(success=False, error="Text content is empty")

    items, root_specs = parse_spec_text_or_blocks(request.text)
    return ExtractionResponse(
        success=True,
        total_items=len(items),
        items=items,
        root_specs=root_specs,
        metadata={"source": "plain_text"}
    )


@app.post("/api/v1/extract-file", response_model=ExtractionResponse)
async def extract_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    file_bytes = await file.read()

    if not file_bytes:
        return ExtractionResponse(success=False, error="Uploaded file is empty")

    try:
        items = []
        root_specs = {}

        if filename.endswith(".pdf"):
            # 1. First try tabular extraction with pdfplumber
            items, root_specs = parse_pdf_tables(file_bytes)

            # 2. If table extraction returned 0 items, fallback to block-aware text parsing
            if not items:
                items, root_specs = parse_pdf_blocks(file_bytes)

        elif filename.endswith((".xlsx", ".xls", ".csv")):
            # Excel / CSV parsing
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            sheet = wb.active

            current_idx = 1
            for row in sheet.iter_rows(values_only=True):
                if not row or all(v is None for v in row):
                    continue
                row_str = " ".join([str(v) for v in row if v is not None])
                v_type = normalize_valve_type(row_str)
                v_size = normalize_size(row_str)
                v_class = normalize_class(row_str)

                if v_type or (v_size and v_class):
                    items.append(ValveItem(
                        item_no=current_idx,
                        description=row_str,
                        valve_type=v_type or "Ball Valve",
                        valve_size=v_size,
                        valve_class=v_class,
                        quantity=1,
                        unit="NOS",
                        valve_moc_body=normalize_material(row_str),
                        valve_end_connection=normalize_end_connection(row_str),
                        valve_operating=normalize_operation(row_str),
                        confidence=1.0,
                        provenance="PYTHON_EXCEL"
                    ))
                    current_idx += 1

        else:
            return ExtractionResponse(
                success=False,
                error=f"Unsupported file type: {filename}. Supported formats: PDF, XLSX, XLS, CSV"
            )

        return ExtractionResponse(
            success=True,
            total_items=len(items),
            items=items,
            root_specs=root_specs,
            metadata={"filename": file.filename, "size_bytes": len(file_bytes)}
        )

    except Exception as err:
        return ExtractionResponse(
            success=False,
            total_items=0,
            items=[],
            error=str(err)
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_EXTRACTOR_PORT", 8001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
