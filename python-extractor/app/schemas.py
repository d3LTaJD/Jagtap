from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ValveItem(BaseModel):
    item_no: Optional[int] = Field(None, description="Item serial number")
    description: str = Field(..., description="Full line item description")
    valve_type: Optional[str] = Field(None, description="Normalized valve type (e.g. Ball Valve)")
    valve_size: Optional[str] = Field(None, description="Normalized size in mm (e.g. 50 mm)")
    valve_class: Optional[str] = Field(None, description="Normalized pressure class (e.g. 150#)")
    quantity: Optional[int] = Field(1, description="Quantity required")
    unit: str = Field("NOS", description="Unit of measurement")
    valve_moc_body: Optional[str] = Field(None, description="Body material grade (e.g. ASTM A216 WCB)")
    valve_end_connection: Optional[str] = Field(None, description="End connection (e.g. Flanged RF)")
    valve_operating: Optional[str] = Field(None, description="Operation / actuation (e.g. Manual, Lever, Gear)")
    valve_design_std: Optional[str] = Field(None, description="Design standard (e.g. API 6D, API 600)")
    valve_testing_std: Optional[str] = Field(None, description="Testing standard (e.g. API 6D, API 598)")
    tag_number: Optional[str] = Field(None, description="Tag or equipment number")
    confidence: float = Field(1.0, description="Confidence score between 0.0 and 1.0")
    provenance: str = Field("DETERMINISTIC_PYTHON", description="Extraction provenance")


class ExtractionResponse(BaseModel):
    success: bool = True
    total_items: int = 0
    items: List[ValveItem] = []
    root_specs: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}
    error: Optional[str] = None
