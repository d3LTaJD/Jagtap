# PETRO VALVES PVT. LTD.
## Dynamic Master Module — Feature Proposal

**Prepared by:** Jagtap Engineering (Development Team)  
**Date:** 18th May 2026  
**Version:** 1.0  
**Status:** Awaiting Client Approval  

---

## 1. Objective

Convert all static/hardcoded field titles and their dropdown values (as defined in the **CODE SHEETS**) into a fully dynamic, admin-configurable **Master Module** within the Jagtap Workflow Platform.

This ensures that any future additions, modifications, or deletions to product fields and their values can be done **directly from the application** by authorized users — without requiring any code changes.

---

## 2. Scope — Fields to be Made Dynamic

Based on the CODE SHEETS (REV02-15.05.2026), the following **11 master fields** and their respective values will be managed dynamically:

| Sr. | Field Title (Column) | Example Values (from Code Sheet) |
|-----|----------------------|----------------------------------|
| 1 | **VALVE TYPE** | Ball Valve, Globe Valve, Gate Valve, Conduit Gate Valve, Check Valve, 3-Way SQ, 3-Way D, 4-Way Valve, Flush Bottom, Butterfly, Knife Gate, 2-Way Bottom, Lug Valve, Disky Type, Swing Type, Lift Type |
| 2 | **DESIGN TYPE** | 01-1 P/C Long, 02-2P/C Long, 03-3P/C, 04-3P/C Welded, 05-3P/C Weldolet, 11-1P/C Short, 12-2P/C Short, 13-3P/C Short, 31-2Way L, 32-2Way T, 31-3Way BL, 32-3Way DT, 41-4Way LL, 51-Disky Type, 61-Swing Type, 62-Lift Type |
| 3 | **BORE** | F=Full Bore, R=Red Bore, X (Not Applicable) |
| 4 | **END CONNECTION** | FL=Flange, DW=Butt Weld, UP=DW with PUP, FF=FLX BW, FP=FLXRW with PUP, SW=Socket Weld, SA=SW with Nipple, SP=SW with PUP/FXSW, ST=SWATH NPT(F), SM=SWATH NPT(M), TN=T-REDED NPT(F), TM=T-REDED NPT(M), TC=T-REDED DSP(F), TP=T-REDED DSP(F), TS=T-NPT-FXSW with, TQ=T-NPT/NPTXSW |
| 5 | **CLASS** | 01-150, 02-300, 04-600, 05-800, 07-1500, 08-2500 |
| 6 | **OPERATING** | H=Handle/Handwheel, G=Gear Box, M=MOV ACT, Q=Gas Power, E=ELE ACT, R=EHOV, S=HOV, A=EXT Hand, B=EXT Gear, C=EXT PNE, D=EXT Goova, F=ELT Gas, #EXT ELE ACT, E=EXT EHOV |
| 7 | **BALL TYPE** | FH=Floating Hollow, FS=FLOT Solid, FI=TRU Hollow, FI=TRU Solid, FX=Floiting, TX=Trunn, GB=Globe, FL=FLAX Solid, KW=Knife Wage |
| 8 | **SIZE** | 006=1/4", 010=3/8", 012=1/2", 019=3/4", 025=1", 032=1-1/4", 038=1-1/2", 050=2", 065=2-1/2", etc. |
| 9 | **OPERATION** | A=Assembly, M=Machining, C=Casting, F=Forging, S=SPAR, F=Force, R=Pre Machining, etc. |
| 10 | **PARTS / BOM** | 001=Body, 002=Side P/C, 003=Waste, 004=Bonnet / Cover, 005=Seat Ring, 007=Stem, 009=Gland Packing, 010=Stem Ring, 011=Gland Bush, 012=Gland Nut, 013=Seat Holder, 014=Seal / Clamping Ring, 016=Spring Holder, 016=Compression Spring, etc. |
| 11 | **MOC (Material of Construction)** | 01=ASTM A216 Gr WCB, 02=ASTM A216 Gr WCC, 03=ASTM A351 Gr CF8, 04=ASTM A351 Gr CF8M, 05=ASTM A351 Gr CN7, 06=Gland Stud, 07=Gland Stud, 09=ASTM A361 Gr CF8, etc. |

---

## 3. How It Will Work

### For Admin Users:
1. Navigate to **Master Data** in the sidebar menu.
2. See a list of all 11 master fields (Valve Type, Design Type, Bore, etc.).
3. **Add a new field** — e.g., if a new category like "COATING TYPE" is needed in the future.
4. **Click on any field** to view/manage its values.
5. Inside each field, the admin can:
   - ✅ **Add** a new value (e.g., add a new Valve Type "Plug Valve")
   - ✏️ **Edit** an existing value (e.g., rename or update a code)
   - ❌ **Delete** a value (with confirmation)
   - 🔄 **Reorder** values (drag and drop)

### For Regular Users:
- When creating/editing an **Enquiry**, **Quotation**, or **Product**, all dropdown fields will automatically pull their options from the Master Module.
- No hardcoded values — everything comes from the database.

---

## 4. User Interface Preview

### Master Data List View:
```
┌──────────────────────────────────────────────────┐
│  Master Data                        + Add Field  │
├──────────────────────────────────────────────────┤
│  📋 VALVE TYPE              16 values    Edit ›  │
│  📋 DESIGN TYPE             16 values    Edit ›  │
│  📋 BORE                     3 values    Edit ›  │
│  📋 END CONNECTION          16 values    Edit ›  │
│  📋 CLASS                    6 values    Edit ›  │
│  📋 OPERATING               14 values    Edit ›  │
│  📋 BALL TYPE                9 values    Edit ›  │
│  📋 SIZE                    20+ values   Edit ›  │
│  📋 OPERATION                7 values    Edit ›  │
│  📋 PARTS / BOM            30+ values    Edit ›  │
│  📋 MOC                    20+ values    Edit ›  │
└──────────────────────────────────────────────────┘
```

### Inside a Field (e.g., VALVE TYPE):
```
┌──────────────────────────────────────────────────┐
│  ← Back    VALVE TYPE             + Add Value    │
├──────────────────────────────────────────────────┤
│  Code: BV    Ball Valve                  ✏️  ❌  │
│  Code: GD    Globe Valve                 ✏️  ❌  │
│  Code: GV    Gate Valve                  ✏️  ❌  │
│  Code: GC    Conduit Gate Valve          ✏️  ❌  │
│  Code: SC    Check Valve                 ✏️  ❌  │
│  Code: TW    3-Way SQ                    ✏️  ❌  │
│  Code: TW    3-Way D                     ✏️  ❌  │
│  Code: TW    4-Way Valve                 ✏️  ❌  │
│  ...                                             │
└──────────────────────────────────────────────────┘
```

---

## 5. Benefits

| Benefit | Description |
|---------|-------------|
| **No Code Changes** | Admin can add/remove fields and values anytime without developer involvement |
| **Consistency** | All forms across the platform use the same centralized data |
| **Audit Trail** | Every change to master data is logged with timestamp and user |
| **Scalability** | New product categories or specifications can be added instantly |
| **Error Reduction** | Dropdowns prevent manual typing errors in product codes |

---

## 6. Access Control

| Role | Can View | Can Add/Edit | Can Delete |
|------|----------|-------------|------------|
| Super Admin | ✅ | ✅ | ✅ |
| Director | ✅ | ✅ | ❌ |
| Manager | ✅ | ❌ | ❌ |
| Accounts / Other | ❌ | ❌ | ❌ |

*(Access levels can be customized as per your requirement)*

---

## 7. Action Required

Please review the above proposal and confirm:

- [ ] Are all 11 fields listed correctly?
- [ ] Are there any additional fields that need to be included?
- [ ] Are the example values accurate, or do any need correction?
- [ ] Is the proposed access control acceptable?
- [ ] Any other requirements or changes?

---

**Please reply with your approval or feedback so we can begin implementation.**

---

*Document prepared by Jagtap Engineering Development Team*  
*For queries, contact the project team directly.*
