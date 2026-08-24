import re
from typing import Optional, Dict, Tuple

VALVE_TYPE_ALIASES = {
    'ball valve': 'Ball Valve', 'ball': 'Ball Valve', 'b.v': 'Ball Valve', 'bv': 'Ball Valve',
    'floating ball valve': 'Floating Ball Valve', 'fbv': 'Floating Ball Valve',
    'trunnion mounted ball valve': 'Trunnion Mounted Ball Valve', 'trunnion ball valve': 'Trunnion Mounted Ball Valve',
    'tmbv': 'Trunnion Mounted Ball Valve', 'gate valve': 'Gate Valve', 'gate': 'Gate Valve', 'gv': 'Gate Valve',
    'knife gate valve': 'Knife Gate Valve', 'globe valve': 'Globe Valve', 'globe': 'Globe Valve',
    'check valve': 'Check Valve', 'check': 'Check Valve', 'chk': 'Check Valve', 'nrv': 'Check Valve',
    'swing check valve': 'Swing Check Valve', 'dual plate check valve': 'Dual Plate Check Valve',
    'butterfly valve': 'Butterfly Valve', 'bfv': 'Butterfly Valve', 'plug valve': 'Plug Valve',
    'control valve': 'Control Valve', 'needle valve': 'Needle Valve', 'safety valve': 'Safety Valve'
}

CLASS_ALIASES = {
    '150': '150#', '150#': '150#', 'cl150': '150#', 'class 150': '150#', '150 class': '150#', '150lbs': '150#', '150 lbs': '150#', 'cl-150': '150#',
    '300': '300#', '300#': '300#', 'cl300': '300#', 'class 300': '300#', '300 class': '300#', '300lbs': '300#', '300 lbs': '300#', 'cl-300': '300#',
    '600': '600#', '600#': '600#', 'cl600': '600#', 'class 600': '600#', '600 class': '600#', '600lbs': '600#', '600 lbs': '600#', 'cl-600': '600#',
    '800': '800#', '800#': '800#', 'cl800': '800#', 'class 800': '800#', '800 class': '800#', '800lbs': '800#', '800 lbs': '800#', 'cl-800': '800#',
    '900': '900#', '900#': '900#', 'cl900': '900#', 'class 900': '900#', '900 class': '900#', '900lbs': '900#', '900 lbs': '900#', 'cl-900': '900#',
    '1500': '1500#', '1500#': '1500#', 'cl1500': '1500#', 'class 1500': '1500#', '1500 class': '1500#', '1500lbs': '1500#', '1500 lbs': '1500#', 'cl-1500': '1500#',
    '2500': '2500#', '2500#': '2500#', 'cl2500': '2500#', 'class 2500': '2500#', '2500 class': '2500#', '2500lbs': '2500#', '2500 lbs': '2500#', 'cl-2500': '2500#'
}

INCH_TO_MM_MAP = {
    '1/2"': '15 mm', '1/2': '15 mm', '15': '15 mm', '15mm': '15 mm', '15 nb': '15 mm', '15nb': '15 mm', 'dn15': '15 mm',
    '3/4"': '20 mm', '3/4': '20 mm', '20': '20 mm', '20mm': '20 mm', '20 nb': '20 mm', '20nb': '20 mm', 'dn20': '20 mm',
    '1"': '25 mm', '1': '25 mm', '25': '25 mm', '25mm': '25 mm', '25 nb': '25 mm', '25nb': '25 mm', 'dn25': '25 mm',
    '1-1/4"': '32 mm', '1 1/4"': '32 mm', '32': '32 mm', '32mm': '32 mm', '32 nb': '32 mm', '32nb': '32 mm', 'dn32': '32 mm',
    '1-1/2"': '40 mm', '1 1/2"': '40 mm', '40': '40 mm', '40mm': '40 mm', '40 nb': '40 mm', '40nb': '40 mm', 'dn40': '40 mm',
    '2"': '50 mm', '2': '50 mm', '50': '50 mm', '50mm': '50 mm', '50 nb': '50 mm', '50nb': '50 mm', 'dn50': '50 mm',
    '2-1/2"': '65 mm', '2 1/2"': '65 mm', '65': '65 mm', '65mm': '65 mm', '65 nb': '65 mm', '65nb': '65 mm', 'dn65': '65 mm',
    '3"': '80 mm', '3': '80 mm', '80': '80 mm', '80mm': '80 mm', '80 nb': '80 mm', '80nb': '80 mm', 'dn80': '80 mm',
    '4"': '100 mm', '4': '100 mm', '100': '100 mm', '100mm': '100 mm', '100 nb': '100 mm', '100nb': '100 mm', 'dn100': '100 mm',
    '5"': '125 mm', '5': '125 mm', '125': '125 mm', '125mm': '125 mm', '125 nb': '125 mm', '125nb': '125 mm', 'dn125': '125 mm',
    '6"': '150 mm', '6': '150 mm', '150': '150 mm', '150mm': '150 mm', '150 nb': '150 mm', '150nb': '150 mm', 'dn150': '150 mm',
    '8"': '200 mm', '8': '200 mm', '200': '200 mm', '200mm': '200 mm', '200 nb': '200 mm', '200nb': '200 mm', 'dn200': '200 mm',
    '10"': '250 mm', '10': '250 mm', '250': '250 mm', '250mm': '250 mm', '250 nb': '250 mm', '250nb': '250 mm', 'dn250': '250 mm',
    '12"': '300 mm', '12': '300 mm', '300': '300 mm', '300mm': '300 mm', '300 nb': '300 mm', '300nb': '300 mm', 'dn300': '300 mm',
    '14"': '350 mm', '14': '350 mm', '350': '350 mm', '350mm': '350 mm', '350 nb': '350 mm', '350nb': '350 mm', 'dn350': '350 mm',
    '16"': '400 mm', '16': '400 mm', '400': '400 mm', '400mm': '400 mm', '400 nb': '400 mm', '400nb': '400 mm', 'dn400': '400 mm',
    '18"': '450 mm', '18': '450 mm', '450': '450 mm', '450mm': '450 mm', '450 nb': '450 mm', '450nb': '450 mm', 'dn450': '450 mm',
    '20"': '500 mm', '20': '500 mm', '500': '500 mm', '500mm': '500 mm', '500 nb': '500 mm', '500nb': '500 mm', 'dn500': '500 mm',
    '24"': '600 mm', '24': '600 mm', '600': '600 mm', '600mm': '600 mm', '600 nb': '600 mm', '600nb': '600 mm', 'dn600': '600 mm',
    '28"': '700 mm', '700': '700 mm', '700 nb': '700 mm', '30"': '750 mm', '750': '750 mm', '750 nb': '750 mm',
    '36"': '900 mm', '900': '900 mm', '900 nb': '900 mm', '40"': '1000 mm', '1000': '1000 mm', '1000 nb': '1000 mm',
    '48"': '1200 mm', '1200': '1200 mm', '1200 nb': '1200 mm', '80"': '2000 mm', '2000': '2000 mm'
}

MATERIAL_ALIASES = {
    'wcb': 'ASTM A216 WCB', 'a216 wcb': 'ASTM A216 WCB', 'astm a216 wcb': 'ASTM A216 WCB',
    'a216-wcb': 'ASTM A216 WCB', 'a-216 wcb': 'ASTM A216 WCB', 'astm a216 gr. wcb': 'ASTM A216 WCB',
    'cs': 'ASTM A216 WCB', 'cast steel': 'ASTM A216 WCB', 'carbon steel': 'ASTM A216 WCB',
    'a105': 'ASTM A105', 'astm a105': 'ASTM A105', 'a-105': 'ASTM A105', 'forged steel': 'ASTM A105',
    'lf2': 'ASTM A350 LF2', 'a350 lf2': 'ASTM A350 LF2', 'lcb': 'ASTM A352 LCB', 'a352 lcb': 'ASTM A352 LCB',
    'ss316': 'SS316', 'ss 316': 'SS316', '316ss': 'SS316', '316 ss': 'SS316', 'stainless steel 316': 'SS316',
    'ss316l': 'SS316L', 'ss 316l': 'SS316L', 'ss304': 'SS304', 'ss 304': 'SS304', 'stainless steel 304': 'SS304',
    'f316': 'ASTM A182 F316', 'f304': 'ASTM A182 F304', 'f51': 'Duplex F51 (UNS S31803)', 'f53': 'Super Duplex F53 (UNS S32750)'
}

END_CONNECTION_ALIASES = {
    'flanged rf': 'Flanged RF', 'flg rf': 'Flanged RF', 'flg. rf': 'Flanged RF', 'flanged raised face': 'Flanged RF',
    'rf': 'Flanged RF', 'raised face': 'Flanged RF', 'flanged': 'Flanged', 'flg': 'Flanged',
    'flanged rtj': 'Flanged RTJ', 'rtj': 'Flanged RTJ', 'flanged flat face': 'Flanged Flat Face', 'ff': 'Flanged Flat Face',
    'butt weld': 'Butt Weld', 'b/w': 'Butt Weld', 'bw': 'Butt Weld',
    'socket weld': 'Socket Weld', 's/w': 'Socket Weld', 'sw': 'Socket Weld',
    'npt': 'NPT Threaded', 'threaded': 'NPT Threaded', 'screwed': 'NPT Threaded',
    'wafer': 'Wafer', 'lug': 'Lug'
}

OPERATION_ALIASES = {
    'manual': 'Manual', 'handwheel': 'Manual', 'lever': 'Lever Operated', 'lever operated': 'Lever Operated',
    'gear': 'Gear Operated', 'gear operated': 'Gear Operated', 'gearbox': 'Gear Operated',
    'pneumatic': 'Pneumatic', 'pneumatic actuator': 'Pneumatic', 'air operated': 'Pneumatic',
    'electric': 'Electric', 'motorized': 'Motorized', 'motor operated': 'Motorized', 'mov': 'Motorized',
    'bare shaft': 'Bare Shaft'
}


def normalize_valve_type(text: str) -> Optional[str]:
    if not text:
        return None
    lower = text.lower().strip()
    sorted_aliases = sorted(VALVE_TYPE_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, canonical in sorted_aliases:
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            return canonical
    return None


def normalize_class(text: str) -> Optional[str]:
    if not text:
        return None
    lower = text.lower().strip()
    match = re.search(r'\b(150|300|600|800|900|1500|2500)\s*(?:#|lbs?|class|cl)?\b', lower)
    if match:
        val = match.group(1)
        return CLASS_ALIASES.get(val, f"{val}#")
    sorted_aliases = sorted(CLASS_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, canonical in sorted_aliases:
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            return canonical
    return None


def normalize_size(text: str) -> Optional[str]:
    if not text:
        return None
    lower = text.lower().strip()
    # 1. Match explicit DN or NPS or NB or mm or inch
    patterns = [
        r'\b(?:dn\s*|nb\s*)([0-9]+)\b',
        r'\b([0-9]+)\s*(?:mm|nb|dn)\b',
        r'\b([0-9]+(?:\/[0-9]+)?(?:\.[0-9]+)?)\s*(?:"|inch|inches|in\b)',
        r'\b([0-9]+\/[0-9]+"|[0-9\.]+")'
    ]
    for pat in patterns:
        match = re.search(pat, lower)
        if match:
            raw_token = match.group(1).strip()
            full_match = match.group(0).strip()
            if full_match in INCH_TO_MM_MAP:
                return INCH_TO_MM_MAP[full_match]
            if raw_token in INCH_TO_MM_MAP:
                return INCH_TO_MM_MAP[raw_token]
            cleaned = full_match.replace(' ', '')
            if cleaned in INCH_TO_MM_MAP:
                return INCH_TO_MM_MAP[cleaned]
    
    # Direct dictionary lookup
    cleaned_text = lower.replace(' ', '')
    if cleaned_text in INCH_TO_MM_MAP:
        return INCH_TO_MM_MAP[cleaned_text]
    if lower in INCH_TO_MM_MAP:
        return INCH_TO_MM_MAP[lower]

    return None


def normalize_material(text: str) -> Optional[str]:
    if not text:
        return None
    lower = text.lower().strip()
    sorted_aliases = sorted(MATERIAL_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, canonical in sorted_aliases:
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            return canonical
    return None


def normalize_end_connection(text: str) -> Optional[str]:
    if not text:
        return None
    lower = text.lower().strip()
    sorted_aliases = sorted(END_CONNECTION_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, canonical in sorted_aliases:
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            return canonical
    return None


def normalize_operation(text: str) -> Optional[str]:
    if not text:
        return None
    lower = text.lower().strip()
    sorted_aliases = sorted(OPERATION_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, canonical in sorted_aliases:
        if re.search(r'\b' + re.escape(alias) + r'\b', lower):
            return canonical
    return None
