# Pet Gamepad development agreements

- This repository owns the ordinary plugin, game integration examples and interactive prototype. The host SDK remains in the desktop-pet repository; never bundle private host code or host installers here.
- Confirmed 2026-09-29: begin implementation in a new GitHub repository; first hardware test is macOS + PS5 DualSense. The user authorized an original interactive settings prototype because no page design exists.
- Do not claim hardware compatibility from synthetic Gamepad data. Record actual device, OS, connection mode and host build separately.
- Preserve keyboard/mouse fallback and existing game/network rules. A reset cancels a charge; it is not a physical release that fires an attack.
- All automated Electron tests start hidden, use isolated userData and their own ports, and terminate only processes started by that test. Do not install into the user's daily profile.
- Tests need named npm scripts and an aggregate gate. Keep regression assertions when reverting product code.
- Prototype state is separate from production settings. Label simulated devices and never display fabricated real connection or calibration success.
- New host APIs require synchronized host, pet-plugin-types, create-pet-plugin and pet-plugin-registry review. Unreleased contracts must be labelled.
- Keep credentials, device raw identifiers, user profiles, logs and private host download locations out of commits and public surfaces.
- Branches use codex/. Do not publish packages, marketplace entries, or host releases without corresponding validation and authorization.
