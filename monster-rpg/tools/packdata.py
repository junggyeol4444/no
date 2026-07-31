#!/usr/bin/env python3
"""packdata.py — JSON -> 바이너리 변환 (SPEC T0-5, data/schema.h 규약).

사용: packdata.py <assets/src 디렉토리> <출력 디렉토리>
산출: species.bin, moves.bin, typechart.bin, strings.bin
스키마를 어기면(바이트 수 불일치) 즉시 실패한다."""
import json
import os
import struct
import sys

TYPE = {"fire": 0, "water": 1, "wood": 2, "earth": 3,
        "metal": 4, "thunder": 5, "light": 6, "dark": 7, "none": 255}
CLASS = {"physical": 0, "special": 1, "status": 2}
# gene_cond 능력치 번호 (SPEC 5-5): 1=HP 2=공격 3=방어 4=특공 5=특방 6=스피드
COND_STAT = {"none": 0, "hp": 1, "atk": 2, "def": 3, "spa": 4, "spd": 5, "spe": 6}
BASE_ORDER = ["hp", "atk", "def", "spa", "spd", "spe"]  # SPEC 5-2 순서
PRIORITY_BIAS = 8


class StringPool:
    """이름 문자열 풀. index 0 = 빈 문자열 (없음 규약)."""
    def __init__(self):
        self.items = [""]
        self.map = {"": 0}

    def intern(self, s):
        if s not in self.map:
            self.map[s] = len(self.items)
            self.items.append(s)
        return self.map[s]

    def to_bytes(self):
        out = struct.pack("<H", len(self.items))
        for s in self.items:
            b = s.encode("utf-8")
            out += struct.pack("<H", len(b)) + b
        return out


def pack_species(data, pool):
    species = sorted(data["species"], key=lambda s: s["id"])
    for i, s in enumerate(species):
        if s["id"] != i + 1:
            die(f"species id 는 1부터 연속이어야 한다: {s['id']} (기대 {i+1})")
    out = struct.pack("<H", len(species))
    for s in species:
        name_idx = pool.intern(s["name"])
        rec = struct.pack("<H", name_idx)
        rec += struct.pack("<B", TYPE[s["type1"]])
        rec += struct.pack("<B", TYPE[s["type2"]])
        for k in BASE_ORDER:
            rec += struct.pack("<B", s["base"][k])
        rec += struct.pack("<B", s.get("catch_rate", 0))
        rec += struct.pack("<B", s.get("base_exp", 0))
        rec += struct.pack("<B", s.get("exp_curve", 0))
        rec += struct.pack("<B", s.get("breed_group", 0))
        rec += struct.pack("<B", s.get("gender_ratio", 0))
        rec += struct.pack("<B", s.get("hatch_tier", 0))
        rec += struct.pack("<H", s.get("learnset_offset", 0))
        rec += struct.pack("<H", s.get("ability_pool", 0))
        if len(rec) != 20:
            die(f"species 레코드가 20바이트가 아니다: {len(rec)}")
        out += rec
    return out


def encode_gene_cond(gc):
    if gc is None or gc.get("target", "none") == "none":
        return 0
    target = 1 if gc["target"] == "recessive" else 0
    stat = COND_STAT[gc.get("stat", "none")]
    threshold = int(gc.get("threshold", 0))
    if not (0 <= threshold <= 15):
        die(f"gene_cond threshold 범위 초과: {threshold}")
    return (target << 7) | ((stat & 0x07) << 4) | (threshold & 0x0F)


def pack_moves(data, pool):
    moves = sorted(data["moves"], key=lambda m: m["id"])
    for i, m in enumerate(moves):
        if m["id"] != i + 1:
            die(f"move id 는 1부터 연속이어야 한다: {m['id']} (기대 {i+1})")
    out = struct.pack("<H", len(moves))
    for m in moves:
        name_idx = pool.intern(m["name"])
        type_class = (TYPE[m["type"]] & 0x0F) | ((CLASS[m["class"]] & 0x03) << 4)
        prio = int(m.get("priority", 0)) + PRIORITY_BIAS
        rec = struct.pack("<H", name_idx)
        rec += struct.pack("<B", type_class)
        rec += struct.pack("<B", prio)
        rec += struct.pack("<B", m["power"])
        rec += struct.pack("<B", m["accuracy"])
        rec += struct.pack("<B", m["pp"])
        rec += struct.pack("<B", m.get("effect_id", 0))
        rec += struct.pack("<B", encode_gene_cond(m.get("gene_cond")))
        if len(rec) != 9:
            die(f"move 레코드가 9바이트가 아니다: {len(rec)}")
        out += rec
    return out


def pack_typechart(data):
    default = data.get("default", 2)
    cells = [default] * 64  # index = atk*8 + def
    for ov in data.get("overrides", []):
        idx = TYPE[ov["atk"]] * 8 + TYPE[ov["def"]]
        cells[idx] = ov["code"]
    out = bytearray(16)
    for idx, code in enumerate(cells):
        byte = idx // 4
        shift = (idx % 4) * 2
        out[byte] |= (code & 0x03) << shift
    if len(out) != 16:
        die("typechart 가 16바이트가 아니다")
    return bytes(out)


def die(msg):
    sys.stderr.write("packdata: 오류: " + msg + "\n")
    sys.exit(1)


def main():
    if len(sys.argv) != 3:
        die("사용: packdata.py <src_dir> <out_dir>")
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)

    with open(os.path.join(src, "species.json"), encoding="utf-8") as f:
        sp = json.load(f)
    with open(os.path.join(src, "moves.json"), encoding="utf-8") as f:
        mv = json.load(f)
    with open(os.path.join(src, "typechart.json"), encoding="utf-8") as f:
        tc = json.load(f)

    pool = StringPool()
    sp_bin = pack_species(sp, pool)
    mv_bin = pack_moves(mv, pool)
    tc_bin = pack_typechart(tc)
    str_bin = pool.to_bytes()

    for name, blob in [("species.bin", sp_bin), ("moves.bin", mv_bin),
                       ("typechart.bin", tc_bin), ("strings.bin", str_bin)]:
        with open(os.path.join(out, name), "wb") as f:
            f.write(blob)
        print(f"packdata: {name}: {len(blob)} 바이트")


if __name__ == "__main__":
    main()
