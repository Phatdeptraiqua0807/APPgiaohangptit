#!/usr/bin/env python3
"""
Công cụ chuyển đổi toàn bộ hình ảnh & video trong dự án ptitngon sang WebP bằng FFmpeg.

Tính năng chính:
  - Chuyển đổi ảnh tĩnh (.jpg, .jpeg, .png, .bmp, .tiff, .jfif, .avif, .heic) sang WebP nhẹ, giữ độ nét & kênh trong suốt.
  - Chuyển đổi GIF / video (.gif, .apng, .mp4, .mov, .webm, .mkv, .avi, .m4v) sang Animated WebP chạy mượt & nhẹ.
  - Xử lý song song đa luồng cực nhanh qua FFmpeg.
  - Tự động cập nhật đường dẫn trong cơ sở dữ liệu (database.json, ai-profiles.json) và mã nguồn (js/, css/, index.html, sw.js, server.js, manifest.webmanifest).
  - Kiểm tra hợp lệ JSON và kiểm tra không có liên kết nội bộ bị gãy sau khi cập nhật.
  - Tự động sao lưu (backup) toàn bộ file gốc + file dữ liệu/code trước khi sửa, hỗ trợ khôi phục (`restore`) hoặc xoá backup (`clean-backup`) khi đã ổn.

Cách dùng nhanh:
  python convert_media_to_webp.py convert --dry-run    # Xem trước không sửa file
  python convert_media_to_webp.py convert              # Chuyển đổi + backup + cập nhật DB
  python convert_media_to_webp.py status               # Kiểm tra trạng thái & dung lượng backup
  python convert_media_to_webp.py restore              # Khôi phục nguyên trạng từ backup
  python convert_media_to_webp.py clean-backup         # Xoá backup khi đã test ổn định
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_BACKUP_DIR = ROOT_DIR / ".media_webp_backup"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".jfif", ".avif", ".heic", ".heif"}
ANIMATED_IMAGE_EXTS = {".gif", ".apng"}
VIDEO_EXTS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v", ".flv", ".wmv"}
ALL_MEDIA_EXTS = IMAGE_EXTS | ANIMATED_IMAGE_EXTS | VIDEO_EXTS

SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".agents",
    ".vscode",
    ".media_webp_backup",
    "brag-output",
}

TEXT_UPDATE_EXTS = {".js", ".html", ".htm", ".css", ".webmanifest"}
JSON_DB_FILES = {"database.json", "ai-profiles.json"}


def format_bytes(num: int) -> str:
    value = float(num)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024.0 or unit == "GB":
            return f"{value:.2f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024.0
    return f"{num} B"


def find_ffmpeg(explicit: Optional[str] = None) -> str:
    candidates: List[str] = []
    if explicit:
        candidates.append(explicit)
    which_hit = shutil.which("ffmpeg")
    if which_hit:
        candidates.append(which_hit)
    candidates.extend([
        r"C:\Program Files\ShareX\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        str(Path.home() / "scoop" / "shims" / "ffmpeg.exe"),
    ])

    seen = set()
    for cand in candidates:
        if not cand or cand in seen:
            continue
        seen.add(cand)
        p = Path(cand)
        if p.is_file():
            return str(p)
    raise FileNotFoundError(
        "Không tìm thấy ffmpeg. Hãy cài đặt ffmpeg vào PATH hoặc truyền --ffmpeg <đường_dẫn>."
    )


def detect_webp_encoders(ffmpeg_exe: str) -> Tuple[bool, bool]:
    """Return (has_libwebp, has_libwebp_anim)."""
    try:
        proc = subprocess.run(
            [ffmpeg_exe, "-hide_banner", "-encoders"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
        )
        out = (proc.stdout or "") + "\n" + (proc.stderr or "")
        return ("libwebp" in out, "libwebp_anim" in out)
    except Exception:
        return (True, False)


def scan_media_files(root: Path, include_brag: bool = False) -> List[Path]:
    skip = set(SKIP_DIRS)
    if include_brag:
        skip.discard("brag-output")

    results: List[Path] = []
    for cur_root, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip and not d.startswith("."))
        for fname in sorted(files):
            p = Path(cur_root) / fname
            if p.suffix.lower() in ALL_MEDIA_EXTS:
                results.append(p)
    return results


def plan_target_path(src: Path, reserved_targets: set[Path]) -> Path:
    """Choose a collision-free .webp destination in the same folder."""
    candidate = src.with_suffix(".webp")
    if not candidate.exists() and candidate not in reserved_targets:
        reserved_targets.add(candidate)
        return candidate

    ext_tag = src.suffix.lstrip(".").lower() or "media"
    alt = src.with_name(f"{src.stem}_{ext_tag}.webp")
    idx = 2
    while alt.exists() or alt in reserved_targets:
        alt = src.with_name(f"{src.stem}_{ext_tag}_{idx}.webp")
        idx += 1
    reserved_targets.add(alt)
    return alt


def build_ffmpeg_command(
    ffmpeg_exe: str,
    src: Path,
    dst: Path,
    image_quality: int,
    video_quality: int,
    max_dim: int,
    video_max_width: int,
    video_fps: int,
    has_libwebp_anim: bool,
) -> List[str]:
    ext = src.suffix.lower()
    base = [ffmpeg_exe, "-y", "-hide_banner", "-loglevel", "error", "-i", str(src)]

    if ext in IMAGE_EXTS:
        vf = f"scale='min({max_dim},iw)':'min({max_dim},ih)':force_original_aspect_ratio=decrease:flags=lanczos"
        return base + [
            "-vf", vf,
            "-c:v", "libwebp",
            "-quality", str(image_quality),
            "-compression_level", "4",
            "-preset", "picture",
            "-frames:v", "1",
            str(dst),
        ]

    # Animated GIF / APNG / Video -> Animated WebP
    encoder = "libwebp_anim" if has_libwebp_anim else "libwebp"
    if ext in ANIMATED_IMAGE_EXTS:
        vf = f"scale='min({video_max_width},iw)':-1:flags=lanczos"
        return base + [
            "-vf", vf,
            "-c:v", encoder,
            "-quality", str(video_quality),
            "-compression_level", "4",
            "-loop", "0",
            "-fps_mode", "passthrough",
            str(dst),
        ]

    vf = f"fps={video_fps},scale='min({video_max_width},iw)':-1:flags=lanczos"
    return base + [
        "-an",
        "-vf", vf,
        "-c:v", encoder,
        "-quality", str(video_quality),
        "-compression_level", "4",
        "-loop", "0",
        str(dst),
    ]


def convert_single_media(
    ffmpeg_exe: str,
    src: Path,
    dst: Path,
    image_quality: int,
    video_quality: int,
    max_dim: int,
    video_max_width: int,
    video_fps: int,
    has_libwebp_anim: bool,
) -> Tuple[bool, str]:
    tmp_dst = dst.with_name(f".{dst.stem}.{uuid.uuid4().hex[:8]}.tmp.webp")
    cmd = build_ffmpeg_command(
        ffmpeg_exe=ffmpeg_exe,
        src=src,
        dst=tmp_dst,
        image_quality=image_quality,
        video_quality=video_quality,
        max_dim=max_dim,
        video_max_width=video_max_width,
        video_fps=video_fps,
        has_libwebp_anim=has_libwebp_anim,
    )
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,
        )
        if proc.returncode != 0 or not tmp_dst.is_file() or tmp_dst.stat().st_size == 0:
            err = (proc.stderr or proc.stdout or f"exit={proc.returncode}").strip()
            if tmp_dst.exists():
                tmp_dst.unlink(missing_ok=True)
            return False, err

        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(tmp_dst), str(dst))
        return True, "ok"
    except Exception as exc:
        if tmp_dst.exists():
            tmp_dst.unlink(missing_ok=True)
        return False, str(exc)


def collect_project_text_files(root: Path, include_brag: bool = False) -> Tuple[List[Path], List[Path]]:
    """Return (json_db_files, code_text_files)."""
    skip = set(SKIP_DIRS)
    if include_brag:
        skip.discard("brag-output")

    json_files: List[Path] = []
    text_files: List[Path] = []
    this_script = Path(__file__).resolve()

    for cur_root, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip and not d.startswith("."))
        for fname in sorted(files):
            p = Path(cur_root) / fname
            if p.resolve() == this_script:
                continue
            rel_posix = p.relative_to(root).as_posix()
            if rel_posix in JSON_DB_FILES:
                json_files.append(p)
            elif p.suffix.lower() in TEXT_UPDATE_EXTS:
                text_files.append(p)
    return json_files, text_files


def normalize_rel_variants(old_rel: str, new_rel: str) -> List[Tuple[str, str]]:
    """Generate exact local path variants so we never touch unrelated external URLs."""
    old_win = old_rel.replace("/", "\\")
    new_win = new_rel.replace("/", "\\")
    old_win_esc = old_rel.replace("/", "\\\\")
    new_win_esc = new_rel.replace("/", "\\\\")
    return [
        (f"./{old_rel}", f"./{new_rel}"),
        (f"/{old_rel}", f"/{new_rel}"),
        (old_rel, new_rel),
        (old_win_esc, new_win_esc),
        (old_win, new_win),
    ]


def replace_local_paths_in_text(text: str, path_map: Dict[str, str]) -> Tuple[str, int]:
    """
    Replace ONLY exact local path references that appear in path_map,
    preserving external URLs (http://, https://, data:) and exact string boundaries.
    """
    if not path_map:
        return text, 0

    pairs: List[Tuple[str, str]] = []
    for old_rel, new_rel in path_map.items():
        pairs.extend(normalize_rel_variants(old_rel, new_rel))

    # Deduplicate & sort longest-first to avoid partial prefix collisions
    pair_dict = dict(pairs)
    sorted_keys = sorted(pair_dict.keys(), key=len, reverse=True)
    escaped = "|".join(re.escape(k) for k in sorted_keys)

    # Disallow replacing immediately after '://.../' external domains by checking preceding chars
    pattern = re.compile(
        rf"(?<![A-Za-z0-9_.\-/\\])({escaped})(?=$|[\s\"'`?#,;:\)\]\}}>])"
    )

    count = 0

    def _sub(match: re.Match[str]) -> str:
        nonlocal count
        matched = match.group(1)
        count += 1
        return pair_dict[matched]

    updated = pattern.sub(_sub, text)
    return updated, count


def replace_paths_in_json_value(val: Any, path_map: Dict[str, str]) -> Tuple[Any, int]:
    if isinstance(val, str):
        # Quick skip external URLs or data URIs
        low = val.lstrip().lower()
        if low.startswith(("http://", "https://", "data:", "blob:")):
            return val, 0
        return replace_local_paths_in_text(val, path_map)
    if isinstance(val, list):
        total = 0
        out = []
        for item in val:
            new_item, c = replace_paths_in_json_value(item, path_map)
            total += c
            out.append(new_item)
        return out, total
    if isinstance(val, dict):
        total = 0
        out_dict = {}
        for k, v in val.items():
            new_v, c = replace_paths_in_json_value(v, path_map)
            total += c
            out_dict[k] = new_v
        return out_dict, total
    return val, 0


def validate_json_local_assets(root: Path, json_obj: Any) -> List[str]:
    """Verify no local assets/* string in database JSON points to a missing file."""
    missing: List[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, str):
            s = node.strip()
            low = s.lower()
            if low.startswith(("http://", "https://", "data:", "blob:")):
                return
            clean = s.split("?", 1)[0].split("#", 1)[0].lstrip("./")
            if clean.startswith("assets/"):
                if not (root / clean).is_file():
                    missing.append(s)
        elif isinstance(node, list):
            for it in node:
                _walk(it)
        elif isinstance(node, dict):
            for v in node.values():
                _walk(v)

    _walk(json_obj)
    return sorted(set(missing))


def backup_file(root: Path, backup_files_dir: Path, target: Path, already_backed: set[str]) -> None:
    rel = target.relative_to(root).as_posix()
    if rel in already_backed:
        return
    dst = backup_files_dir / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(str(target), str(dst))
    already_backed.add(rel)


def resolve_paths(args: argparse.Namespace) -> Tuple[Path, Path]:
    """Resolve root directory and backup directory consistently across commands."""
    root = Path(args.root).resolve()
    if args.backup_dir:
        cand = Path(args.backup_dir)
        backup_root = cand.resolve() if cand.is_absolute() else (root / cand).resolve()
    else:
        backup_root = (root / ".media_webp_backup").resolve()
    return root, backup_root


def cmd_convert(args: argparse.Namespace) -> int:
    root, backup_root = resolve_paths(args)

    ffmpeg_exe = find_ffmpeg(args.ffmpeg)
    has_webp, has_anim = detect_webp_encoders(ffmpeg_exe)
    if not has_webp:
        raise RuntimeError(f"FFmpeg tại {ffmpeg_exe} không hỗ trợ encoder libwebp.")

    media_files = scan_media_files(root, include_brag=args.include_brag)
    if not media_files:
        print("Không có hình ảnh hay video nào cần chuyển đổi sang WebP.")
        return 0

    reserved: set[Path] = set()
    plan: List[Tuple[Path, Path]] = []
    for src in media_files:
        dst = plan_target_path(src, reserved)
        plan.append((src, dst))

    print(f"FFmpeg: {ffmpeg_exe} (libwebp={has_webp}, libwebp_anim={has_anim})")
    print(f"Tìm thấy {len(plan)} file media cần chuyển đổi sang .webp.")

    json_db_files, text_files = collect_project_text_files(root, include_brag=args.include_brag)

    if args.dry_run:
        est_map = {src.relative_to(root).as_posix(): dst.relative_to(root).as_posix() for src, dst in plan}
        total_bytes = sum(src.stat().st_size for src, _ in plan)
        print(f"[DRY-RUN] Tổng dung lượng media gốc: {format_bytes(total_bytes)}")
        for src, dst in plan[:15]:
            print(f"  - {src.relative_to(root).as_posix()} -> {dst.relative_to(root).as_posix()}")
        if len(plan) > 15:
            print(f"  ... và {len(plan) - 15} file khác.")

        ref_hits = 0
        for jf in json_db_files:
            raw = jf.read_text(encoding="utf-8")
            obj = json.loads(raw)
            _, c = replace_paths_in_json_value(obj, est_map)
            ref_hits += c
            print(f"[DRY-RUN] Sẽ cập nhật {c} đường dẫn trong {jf.relative_to(root).as_posix()}")
        for tf in text_files:
            raw = tf.read_text(encoding="utf-8", errors="ignore")
            _, c = replace_local_paths_in_text(raw, est_map)
            if c > 0:
                ref_hits += c
                print(f"[DRY-RUN] Sẽ cập nhật {c} đường dẫn trong {tf.relative_to(root).as_posix()}")
        print(f"[DRY-RUN] Tổng cộng {ref_hits} tham chiếu sẽ được cập nhật. Không có file nào bị sửa.")
        return 0

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_backup_dir = backup_root / run_id
    backup_files_dir = run_backup_dir / "files"
    backup_files_dir.mkdir(parents=True, exist_ok=True)
    backed_set: set[str] = set()

    # 1. Backup tất cả media gốc trước khi chuyển đổi
    for src, _ in plan:
        backup_file(root, backup_files_dir, src, backed_set)

    # 2. Chạy FFmpeg song song
    converted_records: List[Dict[str, Any]] = []
    failed_records: List[Dict[str, str]] = []
    path_map: Dict[str, str] = {}

    def _worker(item: Tuple[Path, Path]) -> Tuple[Path, Path, bool, str, int, int]:
        src, dst = item
        b_before = src.stat().st_size
        ok, msg = convert_single_media(
            ffmpeg_exe=ffmpeg_exe,
            src=src,
            dst=dst,
            image_quality=args.image_quality,
            video_quality=args.video_quality,
            max_dim=args.max_dim,
            video_max_width=args.video_max_width,
            video_fps=args.video_fps,
            has_libwebp_anim=has_anim,
        )
        b_after = dst.stat().st_size if ok and dst.is_file() else 0
        return src, dst, ok, msg, b_before, b_after

    print(f"Đang chuyển đổi với {args.workers} luồng...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for idx, (src, dst, ok, msg, b_before, b_after) in enumerate(pool.map(_worker, plan), 1):
            src_rel = src.relative_to(root).as_posix()
            dst_rel = dst.relative_to(root).as_posix()
            if ok:
                path_map[src_rel] = dst_rel
                converted_records.append({
                    "src": src_rel,
                    "dst": dst_rel,
                    "bytes_before": b_before,
                    "bytes_after": b_after,
                })
                if not args.keep_originals:
                    src.unlink()
            else:
                failed_records.append({"src": src_rel, "error": msg})
                print(f"[LỖI] {src_rel}: {msg}", file=sys.stderr)
            if idx % 25 == 0 or idx == len(plan):
                print(f"  Tiến độ: {idx}/{len(plan)} file")

    # 3. Backup & cập nhật JSON database + codebase
    updated_files_meta: List[Dict[str, Any]] = []

    for jf in json_db_files:
        raw = jf.read_text(encoding="utf-8")
        obj = json.loads(raw)
        new_obj, count = replace_paths_in_json_value(obj, path_map)
        if count > 0:
            backup_file(root, backup_files_dir, jf, backed_set)
            serialized = json.dumps(new_obj, ensure_ascii=False, indent=2) + "\n"
            # Verify serialized JSON parses cleanly before saving final file
            verified_obj = json.loads(serialized)
            tmp_jf = jf.with_name(f".{jf.name}.{uuid.uuid4().hex[:6]}.tmp")
            tmp_jf.write_text(serialized, encoding="utf-8")
            shutil.move(str(tmp_jf), str(jf))

            missing = validate_json_local_assets(root, verified_obj)
            rel_jf = jf.relative_to(root).as_posix()
            updated_files_meta.append({"file": rel_jf, "replacements": count, "missing_after": missing})
            if missing:
                print(f"[CẢNH BÁO] {rel_jf} còn {len(missing)} đường dẫn chưa thấy file: {missing[:5]}", file=sys.stderr)

    for tf in text_files:
        raw = tf.read_text(encoding="utf-8")
        new_text, count = replace_local_paths_in_text(raw, path_map)
        if count > 0:
            backup_file(root, backup_files_dir, tf, backed_set)
            tmp_tf = tf.with_name(f".{tf.name}.{uuid.uuid4().hex[:6]}.tmp")
            tmp_tf.write_text(new_text, encoding="utf-8")
            shutil.move(str(tmp_tf), str(tf))
            updated_files_meta.append({"file": tf.relative_to(root).as_posix(), "replacements": count})

    manifest = {
        "run_id": run_id,
        "created_at": datetime.now().isoformat(),
        "keep_originals": bool(args.keep_originals),
        "converted": converted_records,
        "failed": failed_records,
        "updated_files": updated_files_meta,
    }
    manifest_path = run_backup_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    bytes_before_sum = sum(r["bytes_before"] for r in converted_records)
    bytes_after_sum = sum(r["bytes_after"] for r in converted_records)
    saved_bytes = max(0, bytes_before_sum - bytes_after_sum)
    pct = (saved_bytes / bytes_before_sum * 100.0) if bytes_before_sum > 0 else 0.0

    print("\n=== HOÀN TẤT CHUYỂN ĐỔI WEBP ===")
    print(f"Thành công      : {len(converted_records)} file")
    print(f"Thất bại        : {len(failed_records)} file")
    print(f"File DB/code sửa: {len(updated_files_meta)} file")
    print(f"Dung lượng trước: {format_bytes(bytes_before_sum)}")
    print(f"Dung lượng sau  : {format_bytes(bytes_after_sum)} (tiết kiệm {format_bytes(saved_bytes)} | -{pct:.1f}%)")
    print(f"Thư mục backup  : {run_backup_dir}")
    print("\nKhi kiểm tra web chạy ổn, hãy xoá backup bằng lệnh:")
    print("  python convert_media_to_webp.py clean-backup")
    return 1 if failed_records else 0


def list_backup_runs(backup_root: Path) -> List[Path]:
    if not backup_root.is_dir():
        return []
    runs = [p for p in backup_root.iterdir() if p.is_dir() and (p / "manifest.json").is_file()]
    return sorted(runs, key=lambda p: p.name)


def folder_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for p in path.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total


def cmd_status(args: argparse.Namespace) -> int:
    root, backup_root = resolve_paths(args)

    skip = set(SKIP_DIRS)
    if args.include_brag:
        skip.discard("brag-output")

    remaining = scan_media_files(root, include_brag=args.include_brag)
    webp_count = 0
    for cur_root, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in skip and not d.startswith("."))
        for fname in files:
            if fname.lower().endswith(".webp"):
                webp_count += 1

    print(f"File WebP hiện có trong dự án : {webp_count}")
    print(f"Ảnh/video chưa chuyển WebP    : {len(remaining)}")

    json_db_files, _ = collect_project_text_files(root, include_brag=args.include_brag)
    for jf in json_db_files:
        try:
            obj = json.loads(jf.read_text(encoding="utf-8"))
            missing = validate_json_local_assets(root, obj)
            print(f"Kiểm tra {jf.relative_to(root).as_posix()}: {len(missing)} liên kết thiếu")
            for m in missing[:10]:
                print(f"  - Thiếu: {m}")
        except Exception as exc:
            print(f"[LỖI JSON] {jf.relative_to(root).as_posix()}: {exc}")

    runs = list_backup_runs(backup_root)
    if not runs:
        print("Backup hiện tại: Không có.")
    else:
        total_bk_size = folder_size(backup_root)
        print(f"Backup hiện có ({len(runs)} bản, tổng {format_bytes(total_bk_size)}):")
        for r in runs:
            m = json.loads((r / "manifest.json").read_text(encoding="utf-8"))
            print(
                f"  - {r.name}: {len(m.get('converted', []))} media, "
                f"{len(m.get('updated_files', []))} file DB/code"
            )
    return 0


def cmd_restore(args: argparse.Namespace) -> int:
    root, backup_root = resolve_paths(args)
    runs = list_backup_runs(backup_root)
    if not runs:
        print("Không tìm thấy backup nào để khôi phục.")
        return 1

    target_run = runs[-1]
    if args.run_id:
        matches = [r for r in runs if r.name == args.run_id]
        if not matches:
            print(f"Không tìm thấy backup run_id={args.run_id}.")
            return 1
        target_run = matches[0]

    manifest = json.loads((target_run / "manifest.json").read_text(encoding="utf-8"))
    files_dir = target_run / "files"

    if not args.yes:
        ans = input(
            f"Khôi phục dữ liệu từ backup '{target_run.name}' "
            f"({len(manifest.get('converted', []))} media, {len(manifest.get('updated_files', []))} DB/code)? [y/N]: "
        ).strip().lower()
        if ans not in ("y", "yes"):
            print("Đã huỷ khôi phục.")
            return 0

    # 1. Xoá các file .webp được tạo bởi lần chạy đó (nếu khác tên gốc)
    removed_webp = 0
    for rec in manifest.get("converted", []):
        src_rel = rec["src"]
        dst_rel = rec["dst"]
        dst_path = root / dst_rel
        if dst_rel != src_rel and dst_path.is_file():
            dst_path.unlink()
            removed_webp += 1

    # 2. Chép lại toàn bộ file gốc + database/code từ backup
    restored = 0
    for backed in files_dir.rglob("*"):
        if not backed.is_file():
            continue
        rel = backed.relative_to(files_dir)
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(backed), str(dest))
        restored += 1

    print(f"Đã khôi phục {restored} file từ backup '{target_run.name}' (đã dọn {removed_webp} file WebP tạo mới).")
    return 0


def cmd_clean_backup(args: argparse.Namespace) -> int:
    _, backup_root = resolve_paths(args)
    if not backup_root.exists():
        print("Không có thư mục backup nào để xoá.")
        return 0

    bk_size = folder_size(backup_root)
    runs = list_backup_runs(backup_root)
    if not args.yes:
        ans = input(
            f"Bạn chắc chắn muốn xoá toàn bộ thư mục backup ({len(runs)} bản, {format_bytes(bk_size)}) tại '{backup_root}'? [y/N]: "
        ).strip().lower()
        if ans not in ("y", "yes"):
            print("Đã huỷ xoá backup.")
            return 0

    shutil.rmtree(backup_root)
    print(f"Đã xoá sạch thư mục backup ({format_bytes(bk_size)} đã được giải phóng).")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Chuyển đổi ảnh & video sang WebP bằng FFmpeg, tự động cập nhật DB & quản lý backup."
    )
    parser.add_argument(
        "--root",
        default=str(ROOT_DIR),
        help="Thư mục gốc của dự án cần quét (mặc định: thư mục chứa script)",
    )
    parser.add_argument(
        "--backup-dir",
        default=None,
        help="Thư mục lưu backup (mặc định: <root>/.media_webp_backup)",
    )
    parser.add_argument(
        "--include-brag",
        action="store_true",
        help="Bao gồm cả thư mục brag-output khi quét media",
    )

    sub = parser.add_subparsers(dest="command", required=True)

    p_conv = sub.add_parser("convert", help="Tạo backup, chuyển ảnh/video sang WebP và cập nhật DB/code")
    p_conv.add_argument("--ffmpeg", default=None, help="Đường dẫn tới ffmpeg.exe nếu không có trong PATH")
    p_conv.add_argument("--image-quality", type=int, default=80, help="Chất lượng WebP cho ảnh tĩnh (0-100, mặc định 80)")
    p_conv.add_argument("--video-quality", type=int, default=72, help="Chất lượng WebP cho GIF/video (0-100, mặc định 72)")
    p_conv.add_argument("--max-dim", type=int, default=1600, help="Chiều rộng/cao tối đa cho ảnh tĩnh (px, mặc định 1600)")
    p_conv.add_argument("--video-max-width", type=int, default=960, help="Chiều rộng tối đa cho GIF/video (px, mặc định 960)")
    p_conv.add_argument("--video-fps", type=int, default=15, help="FPS tối đa cho video chuyển sang WebP (mặc định 15)")
    p_conv.add_argument("--workers", type=int, default=min(6, os.cpu_count() or 4), help="Số luồng FFmpeg song song")
    p_conv.add_argument("--keep-originals", action="store_true", help="Giữ lại file gốc bên cạnh file .webp (ngoài backup)")
    p_conv.add_argument("--dry-run", action="store_true", help="Chỉ mô phỏng và thống kê, không sửa file")
    p_conv.set_defaults(func=cmd_convert)

    p_stat = sub.add_parser("status", help="Kiểm tra trạng thái media, tính hợp lệ DB và dung lượng backup")
    p_stat.set_defaults(func=cmd_status)

    p_rest = sub.add_parser("restore", help="Khôi phục nguyên trạng trước khi chuyển đổi từ backup")
    p_rest.add_argument("--run-id", default=None, help="ID bản backup muốn khôi phục (mặc định: bản mới nhất)")
    p_rest.add_argument("-y", "--yes", action="store_true", help="Xác nhận không cần hỏi lại")
    p_rest.set_defaults(func=cmd_restore)

    p_clean = sub.add_parser("clean-backup", help="Xoá toàn bộ backup khi ứng dụng đã chạy ổn")
    p_clean.add_argument("-y", "--yes", action="store_true", help="Xoá ngay không cần hỏi xác nhận")
    p_clean.set_defaults(func=cmd_clean_backup)

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
