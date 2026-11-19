# RunE Talkie · Run Beirut. Run together.
Open the private moderator link, put on an earpiece, enter a name and tap **Join with audio**. Show the Runners QR to four or more people. Each scans with their phone camera, enters a name and allows the microphone. Keep the page in the foreground during the field test.
 
Tap once to record, then tap again to send. Other turns wait while you record. At 16 kHz mono the 48 MiB upload ceiling allows about 26 minutes per turn. Keep the page open during upload. A failed upload can be retried. Audio and member records on the hosted service persist in the race storage. Use simulated emergency reports for the class exercise.

Runners can all speak. Participants choose Play in the Music channel's Spotify player, whose playback availability depends on Spotify. The moderator sets the playlist and approves Business & Race Announcements speakers. Emergency recordings are available only to the moderator, who can receive them from other channels. Each participant gets a Friends & Family channel and can create private channels. Show a private channel's QR to invite someone. The moderator can enter every channel. The main race QR never grants moderator access.

## Run in GitHub Codespaces
Use Node.js 20 or newer. Run `python server.py` or `npm start` at the repository root. Make forwarded port 8000 public and open the moderator URL printed in the terminal. Keep it private. The local server keeps race data in memory until restart. A moderator URL identifies one race. Keep it to reopen the same race. On a desktop, localhost works for development. Physical phones require HTTPS.

Brand asset from the Beirut Marathon Association website. Independent ENMG 664 course prototype. The bundled QR encoder is QRCode for JavaScript by Kazuhiko Arase (MIT).
