Feesight Firebase Auth + Firestore setup

Files included:
- feesight_school_fees_analyser_v3.html
- firebase-config.js
- firestore.rules
- firebase.json
- .gitignore

Recommended Firebase console steps:
1. In Authentication, enable Google as a sign-in provider.
2. In Firestore Database, create the database in production mode.
3. Publish the included firestore.rules.
4. Deploy hosting if wanted, or serve the files statically.

What the app now does:
- Local save always works.
- Google sign-in enables Firestore sync.
- School records are saved to the schools collection.
- Any signed-in user can read the shared school list.
- Only the creator can update or delete their own school document.

Important note:
The Firebase web config is not a secret. Protect data with Auth + Firestore rules, not by hiding the config in client-side code.
