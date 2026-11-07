"""Create a layered quartermaster/shop composite from the original PNG assets.

Run from any working directory:
    python assets/quartermaster-composition/compose_quartermaster.py

The original assets are copied into source-backup/ before any output is written.
"""

from pathlib import Path
import shutil

from PIL import Image, ImageStat


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = PROJECT_ROOT / "assets"
OUTPUT_DIR = ASSET_DIR / "quartermaster-composition"
BACKUP_DIR = OUTPUT_DIR / "source-backup"

SHOP_PATH = ASSET_DIR / "quartermaster-shop.png"
MERCHANT_PATH = ASSET_DIR / "quartermaster.png"

BACKGROUND_LAYER_PATH = OUTPUT_DIR / "shop_background_layer.png"
MERCHANT_LAYER_PATH = OUTPUT_DIR / "quartermaster_layer.png"
COUNTER_LAYER_PATH = OUTPUT_DIR / "shop_foreground_counter.png"
FINAL_PATH = OUTPUT_DIR / "final_composition.png"

# The measured counter edge is near y=1122 in this asset. The script detects
# it from the strongest horizontal luminance change within the lower scene.
SEARCH_TOP = 1020
SEARCH_BOTTOM = 1180
COUNTER_EDGE_MIN_DELTA = 12.0

# Enlarge the merchant another 20% from the previous composite. The counter
# masks him just below the waist so the larger scale still reads as behind it.
MERCHANT_SCALE = 1.128
VISIBLE_FIGURE_FRACTION = 0.46


def detect_counter_top(image: Image.Image) -> tuple[int, float]:
    """Find the counter's top edge by scanning mean grayscale row changes."""
    gray = image.convert("L")
    first = max(1, SEARCH_TOP)
    last = min(image.height - 1, SEARCH_BOTTOM)
    row_means = [
        ImageStat.Stat(gray.crop((0, y, image.width, y + 1))).mean[0]
        for y in range(first - 1, last + 1)
    ]
    changes = [
        (first + index, row_means[index + 1] - row_means[index])
        for index in range(len(row_means) - 1)
    ]
    edge_y, delta = max(changes, key=lambda change: change[1])
    if delta < COUNTER_EDGE_MIN_DELTA:
        raise RuntimeError(
            f"Could not confidently locate the counter edge: strongest row change "
            f"was {delta:.1f} at y={edge_y}."
        )
    return edge_y, delta


def transparent_layer(size: tuple[int, int]) -> Image.Image:
    return Image.new("RGBA", size, (0, 0, 0, 0))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    # Keep pristine source copies before producing any derived assets.
    shutil.copy2(SHOP_PATH, BACKUP_DIR / SHOP_PATH.name)
    shutil.copy2(MERCHANT_PATH, BACKUP_DIR / MERCHANT_PATH.name)

    shop = Image.open(SHOP_PATH).convert("RGBA")
    merchant = Image.open(MERCHANT_PATH).convert("RGBA")
    if shop.size != merchant.size:
        raise ValueError(
            f"Expected matching source dimensions, got shop={shop.size}, "
            f"merchant={merchant.size}."
        )

    width, height = shop.size
    counter_y, edge_delta = detect_counter_top(shop)

    # Separate the background into full-canvas transparent layers, which makes
    # all three PNGs directly stackable at (0, 0) in an editor.
    background_layer = transparent_layer(shop.size)
    background_layer.alpha_composite(shop.crop((0, 0, width, counter_y)), (0, 0))

    counter_layer = transparent_layer(shop.size)
    counter_layer.alpha_composite(
        shop.crop((0, counter_y, width, height)), (0, counter_y)
    )

    resized_size = (
        max(1, round(merchant.width * MERCHANT_SCALE)),
        max(1, round(merchant.height * MERCHANT_SCALE)),
    )
    scaled_merchant = merchant.resize(resized_size, Image.Resampling.LANCZOS)
    opaque_bounds = scaled_merchant.getchannel("A").point(
        lambda alpha: 255 if alpha >= 64 else 0
    ).getbbox()
    visible_center_x = (
        (opaque_bounds[0] + opaque_bounds[2]) / 2
        if opaque_bounds
        else scaled_merchant.width / 2
    )
    merchant_x = round(width / 2 - visible_center_x)
    visible_height = round(scaled_merchant.height * VISIBLE_FIGURE_FRACTION)
    merchant_y = counter_y - visible_height

    # Save only the visible upper part in the positioned layer; the foreground
    # counter covers everything below the detected edge in the final sandwich.
    visible_merchant = scaled_merchant.crop(
        (0, 0, scaled_merchant.width, visible_height)
    )
    merchant_layer = transparent_layer(shop.size)
    merchant_layer.alpha_composite(visible_merchant, (merchant_x, merchant_y))

    final = transparent_layer(shop.size)
    final.alpha_composite(background_layer)
    final.alpha_composite(merchant_layer)
    final.alpha_composite(counter_layer)

    background_layer.save(BACKGROUND_LAYER_PATH)
    merchant_layer.save(MERCHANT_LAYER_PATH)
    counter_layer.save(COUNTER_LAYER_PATH)
    final.save(FINAL_PATH)

    print(f"Counter top edge: y={counter_y} (row luminance change {edge_delta:.1f})")
    print(
        f"Merchant: scale={MERCHANT_SCALE:.2f}, size={scaled_merchant.size}, "
        f"position=({merchant_x}, {merchant_y}), hidden below y={counter_y}"
    )
    print(f"Saved background layer: {BACKGROUND_LAYER_PATH}")
    print(f"Saved merchant layer:   {MERCHANT_LAYER_PATH}")
    print(f"Saved counter layer:    {COUNTER_LAYER_PATH}")
    print(f"Saved final composite:  {FINAL_PATH}")
    print(f"Source backups:         {BACKUP_DIR}")


if __name__ == "__main__":
    main()
