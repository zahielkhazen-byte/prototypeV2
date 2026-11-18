# RunE Talkie V2

## Two-phone field test with GitHub Codespaces

1. Extract the ZIP. Upload index.html and server.py together to the root of a GitHub repository and commit them.
2. In the repository choose **Code → Codespaces → Create codespace**. In its terminal run `python server.py`.
3. Open **Ports**. Forward port **8000** if needed. Right-click the port and set **Port Visibility → Public**. Copy its forwarded HTTPS address. Keep the codespace running during the test.
4. Open the address in Safari or Chrome on both phones. Connect an earpiece to each phone, enable audio and choose **Runners**. Hold the button for a sentence and release. The other phone plays the message. Repeat in the opposite direction.
5. Create a channel on one phone and select it on the other. **Invite by email** opens your mail app with the channel link. The **Music** channel also has a locally generated running beat each listener can toggle.

Anyone with the public address can join and listen. Channels and short audio turns are held in server memory. Restart the server to reset the session. Stop the codespace after testing.

For a desktop trial, run the same command in the extracted folder and open http://localhost:8000 in two browser tabs. Use headphones. Phones need the forwarded HTTPS address for microphone access. Internet audio is delivered after release. Keep both screens awake and the browser in the foreground.
