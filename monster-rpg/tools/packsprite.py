#!/usr/bin/env python3
"""packsprite.py — PNG -> 팔레트 인덱스 4bit 바이너리 (SPEC T0-5, 26-7).

외부 라이브러리 없이 stdlib(zlib)만으로 PNG(8bit truecolor/RGBA, 무인터레이스)를
디코드한다. 색은 16색 이하여야 한다 (4bit 인덱스).

출력 .spr 포맷 (리틀 엔디언):
  u16 width, u16 height, u8 palette_count
  palette_count × (R,G,B,A)
  ceil(width*height/2) 바이트 4bit 인덱스 (상위 니블 먼저)

사용: packsprite.py <in.png> <out.spr>
"""
import struct
import sys
import zlib


def read_png(path):
    with open(path, "rb") as f:
        data = f.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        die("PNG 시그니처가 아니다: " + path)
    pos = 8
    width = height = bit_depth = color_type = 0
    idat = b""
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length  # length + type + data + crc
        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            interlace = chunk[12]
            if interlace != 0:
                die("인터레이스 PNG 미지원")
            if bit_depth != 8:
                die("8bit 심도만 지원")
            if color_type not in (2, 6):
                die("truecolor(2)/RGBA(6) 만 지원")
        elif ctype == b"IDAT":
            idat += chunk
        elif ctype == b"IEND":
            break
    raw = zlib.decompress(idat)
    channels = 4 if color_type == 6 else 3
    stride = width * channels
    pixels = []  # list of (r,g,b,a)
    prev = bytearray(stride)
    p = 0
    for _y in range(height):
        ftype = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        unfilter(line, prev, ftype, channels)
        for x in range(width):
            off = x * channels
            r, g, b = line[off], line[off + 1], line[off + 2]
            a = line[off + 3] if channels == 4 else 255
            pixels.append((r, g, b, a))
        prev = line
    return width, height, pixels


def paeth(a, b, c):
    pp = a + b - c
    pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def unfilter(line, prev, ftype, ch):
    n = len(line)
    if ftype == 0:
        return
    for i in range(n):
        a = line[i - ch] if i >= ch else 0
        b = prev[i]
        c = prev[i - ch] if i >= ch else 0
        if ftype == 1:
            line[i] = (line[i] + a) & 0xFF
        elif ftype == 2:
            line[i] = (line[i] + b) & 0xFF
        elif ftype == 3:
            line[i] = (line[i] + ((a + b) >> 1)) & 0xFF
        elif ftype == 4:
            line[i] = (line[i] + paeth(a, b, c)) & 0xFF
        else:
            die("알 수 없는 필터 " + str(ftype))


def build_palette(pixels):
    palette = []
    index = {}
    for px in pixels:
        if px not in index:
            if len(palette) >= 16:
                die("색이 16색을 초과한다 (4bit 인덱스 한계)")
            index[px] = len(palette)
            palette.append(px)
    return palette, index


def pack(path_in, path_out):
    w, h, pixels = read_png(path_in)
    palette, index = build_palette(pixels)
    out = struct.pack("<HHB", w, h, len(palette))
    for (r, g, b, a) in palette:
        out += struct.pack("<BBBB", r, g, b, a)
    nib = bytearray((w * h + 1) // 2)
    for i, px in enumerate(pixels):
        v = index[px] & 0x0F
        if i % 2 == 0:
            nib[i // 2] |= v << 4     # 상위 니블 먼저
        else:
            nib[i // 2] |= v
    out += bytes(nib)
    with open(path_out, "wb") as f:
        f.write(out)
    print(f"packsprite: {path_out}: {w}x{h}, {len(palette)}색, {len(out)}바이트")


def die(msg):
    sys.stderr.write("packsprite: 오류: " + msg + "\n")
    sys.exit(1)


def main():
    if len(sys.argv) != 3:
        die("사용: packsprite.py <in.png> <out.spr>")
    pack(sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    main()
