Feesight v6 iPad auth update

What changed
- Detects iPad/iPhone/iOS-style browsers and prefers Google redirect sign-in instead of popup
- Keeps popup sign-in for desktop, with redirect fallback if the popup is blocked
- Better auth status messages
- Still requires localhost or a hosted domain authorised in Firebase

Important
- Google sign-in still will not work properly from a raw file:// URL
- On iPad Chrome, open the app from localhost or hosted HTTPS
- Because Chrome on iPad uses WebKit underneath, redirect is more reliable than popup

Suggested local run from a computer
python3 -m http.server 8000

Then open:
http://<your-computer-ip>:8000/feesight_app_v6_ipad_auth.html

Make sure the URL you use is added to Firebase authorised domains if needed.
