"""Rewrite plot links to absolute paths. Writes only inside this folder."""

from pathlib import Path

root = Path(__file__).resolve().parent
src = root / "Tau_Cet_rebound_stability_20260930.md"
dst = root / "for_dropbox.md"
text = src.read_text(encoding="utf-8")
prefix = "C:/Users/DougJ/Documents/GitHub/orbit_match/tasks/rebound_tau_ceti/plots/"
text = text.replace("](plots/", "](" + prefix)
dst.write_text(text, encoding="utf-8")
print(dst.name, len(text), text.count(prefix))
