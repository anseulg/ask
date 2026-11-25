#!/usr/bin/env python3
"""회의 녹음 → 글(txt) + 자막(srt) 변환기 (OpenAI Whisper).

사용 예:
    python transcribe.py                       # input/ 폴더의 모든 녹음 변환
    python transcribe.py 회의.m4a              # 파일 하나만 변환
    python transcribe.py 회의.m4a --model medium
    python transcribe.py --prompt "11번가, PDP, AX TF"   # 고유명사 인식률 향상
"""
import argparse
import sys
from pathlib import Path

AUDIO_EXTS = {".m4a", ".mp3", ".wav", ".mp4", ".webm", ".ogg", ".flac", ".aac", ".mov", ".mkv"}
HERE = Path(__file__).resolve().parent


def collect(targets):
    files = []
    for t in targets:
        p = Path(t)
        if p.is_dir():
            files += sorted(f for f in p.iterdir() if f.suffix.lower() in AUDIO_EXTS)
        elif p.is_file():
            files.append(p)
        else:
            print(f"⚠️  찾을 수 없음: {p}", file=sys.stderr)
    return files


def main():
    ap = argparse.ArgumentParser(description="회의 녹음을 txt/srt로 변환")
    ap.add_argument("targets", nargs="*", default=[str(HERE / "input")],
                    help="녹음 파일 또는 폴더 (기본: input/)")
    ap.add_argument("--model", default="small",
                    help="tiny | base | small(기본) | medium | large | turbo")
    ap.add_argument("--language", default="Korean", help="기본 Korean")
    ap.add_argument("--output-dir", default=str(HERE / "output"), help="기본: output/")
    ap.add_argument("--formats", default="txt,srt", help="txt,srt,vtt,tsv,json 중 쉼표로")
    ap.add_argument("--prompt", default=None,
                    help="자주 나오는 고유명사·용어 (인식 정확도 향상)")
    args = ap.parse_args()

    files = collect(args.targets)
    if not files:
        print("변환할 녹음 파일이 없습니다. input/ 폴더에 넣거나 파일 경로를 지정하세요.")
        return 1

    run(files, args.model, args.language, args.output_dir, args.formats, args.prompt)
    return 0


_models = {}


def run(files, model_name="small", language="Korean", output_dir=HERE / "output",
        formats="txt,srt", prompt=None, log=print):
    """녹음 파일들을 변환하고 생성된 txt 경로 목록을 돌려준다."""
    import whisper  # 무거우니 필요할 때 로드
    from whisper.utils import get_writer

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    if model_name not in _models:
        log(f"모델 '{model_name}' 불러오는 중… (첫 실행 시 다운로드)")
        _models[model_name] = whisper.load_model(model_name)
    model = _models[model_name]
    writers = [get_writer(f.strip(), str(out)) for f in formats.split(",")]

    txts = []
    for i, f in enumerate(files, 1):
        log(f"[{i}/{len(files)}] {Path(f).name} 변환 중… (길면 오래 걸려요)")
        result = model.transcribe(str(f), language=language,
                                  initial_prompt=prompt, verbose=False)
        for w in writers:
            w(result, str(f), {})
        log(f"   ✅ {Path(f).stem}.{{{formats}}}")
        txts.append(out / f"{Path(f).stem}.txt")
    return txts


if __name__ == "__main__":
    sys.exit(main())
