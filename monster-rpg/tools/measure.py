#!/usr/bin/env python3
"""measure.py — 빌드 산출물 크기를 항목별로 기록 (SPEC T0-7, 26-8).

항목: 실행파일 / 오디오 / 이미지 / 데이터 (SPEC 26-2 영향 순).
결과를 build_size.csv 에 한 줄씩 누적한다.

사용: measure.py --exe <path> --assets <dir> [--csv build_size.csv] [--label NAME]
"""
import argparse
import csv
import datetime
import os
import sys

# 확장자 → 항목 분류
AUDIO_EXT = {".wav", ".song", ".snd"}
IMAGE_EXT = {".spr", ".png", ".chr"}
DATA_EXT = {".bin", ".dat"}


def dir_sizes(assets):
    audio = image = data = 0
    if assets and os.path.isdir(assets):
        for root, _dirs, files in os.walk(assets):
            for fn in files:
                ext = os.path.splitext(fn)[1].lower()
                sz = os.path.getsize(os.path.join(root, fn))
                if ext in AUDIO_EXT:
                    audio += sz
                elif ext in IMAGE_EXT:
                    image += sz
                elif ext in DATA_EXT:
                    data += sz
    return audio, image, data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exe", default="")
    ap.add_argument("--assets", default="")
    ap.add_argument("--csv", default="build_size.csv")
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    exe = os.path.getsize(args.exe) if args.exe and os.path.isfile(args.exe) else 0
    audio, image, data = dir_sizes(args.assets)
    total = exe + audio + image + data

    header = ["timestamp", "label", "executable", "audio", "image", "data", "total"]
    row = [datetime.datetime.now().isoformat(timespec="seconds"),
           args.label, exe, audio, image, data, total]

    new = not os.path.exists(args.csv)
    with open(args.csv, "a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(header)
        w.writerow(row)

    print("measure: " + "  ".join(f"{h}={v}" for h, v in zip(header[2:], row[2:])))
    print(f"measure: {args.csv} 에 1줄 추가")
    return 0


if __name__ == "__main__":
    sys.exit(main())
