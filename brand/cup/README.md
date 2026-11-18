# Approved 80s cup

The owner approved this illustrated electric-blue and hot-pink cup on October 18,
2026, replacing the rejected photorealistic cup and strawberry concept.
The existing main logo and tagline are unchanged.

`approved-80s-cup-source.png` is the original artwork, without the logo.
`tools/build-arcade-cup.py` extracts a transparent shell and an independently
coloured cream layer. It requires Pillow, numpy, and opencv-python.
Run it from the repository root with `python tools/build-arcade-cup.py`.

The builder, mixer and share-card renderer composite the approved logo directly
onto the cup. Garnish choices remain in the written recipe, not as photo stickers.
`site/cup-bubbles.js` powers the builder's automatically rising bubbles.
The owner requested removal of the Play/Pause and Extra fizz buttons.
Motion respects reduced-motion settings and pauses only offscreen or when the tab is hidden.

Production uses normal persistent browser preferences and the existing API routes.
Private-preview storage substitutes and automatic scrolling are not deployed.
