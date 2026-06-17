# Backend Setup — Step by Step

This is the "engine" part of the app. It doesn't have any screens —
it just runs quietly and answers one question: "Is the gate open or
closed right now?" The phone app will talk to this to get that answer.

You will do this in two stages:
- **Stage 1**: Run it on your own PC, just to see it work.
- **Stage 2**: Put it online for free, so your phone can reach it
  from anywhere (not just at home on the same Wi-Fi).

You don't need to understand the code to do either stage. Just
follow the steps in order.

---

## Stage 1: Run it on your PC

### Step 1 — Install Node.js

This is a free program that lets your PC run the backend code.

1. Go to https://nodejs.org
2. Download the version that says **LTS** (it's the stable one).
3. Install it like any normal program (click Next, Next, Finish).
4. To check it worked, open Command Prompt (search "cmd" in the
   Windows start menu) and type:
   ```
   node -v
   ```
   If it prints something like `v20.11.0`, it worked.

### Step 2 — Open the backend folder in Command Prompt

1. Unzip the project folder you downloaded from me somewhere easy to
   find, like your Desktop.
2. Open Command Prompt.
3. Type `cd ` (with a space after it), then drag the `backend` folder
   from File Explorer into the Command Prompt window — this fills in
   the folder path automatically. Press Enter.
   - It should now look something like:
     `C:\Users\YourName\Desktop\railgate\backend>`

### Step 3 — Install the pieces the backend needs

In that same Command Prompt window, type:
```
npm install
```
Press Enter and wait. This downloads two small helper libraries the
code uses. You'll see some text scroll by — that's normal. It's done
when you see your folder path again, ready for the next command.

### Step 4 — Start the backend

Type:
```
npm start
```
You should see:
```
Railway Gate Status API running on port 3000
```
This means it's working and running. **Leave this window open** —
closing it stops the backend.

### Step 5 — Check it in your browser

Open any web browser on the same PC and go to:
```
http://localhost:3000/api/status
```
You should see a page full of text like this:
```
{"status":"OPEN","now":"2026-06-17T...", ...}
```
That's the backend telling you the gate is currently open (or
closed), based on the sample train times already loaded in. This
confirms everything is working correctly.

To stop the backend later, click into that Command Prompt window and
press `Ctrl + C`.

---

## Stage 2: Put it online for free (so it works outside your house)

Right now the backend only works on your own PC. To let your phone
check it from anywhere, you need to put it on a free online service
called **Render**. This requires a free **GitHub** account first
(GitHub is just a place to store your code online — think of it like
Google Drive, but for code).

### Step 1 — Create a GitHub account

Go to https://github.com and sign up for free if you haven't already.

### Step 2 — Upload the backend folder to GitHub

The easiest way without using any command-line tools:

1. On github.com, click the **+** icon top-right → **New repository**.
2. Name it `railgate-backend`. Leave everything else default. Click
   **Create repository**.
3. On the next page, click **uploading an existing file**.
4. Drag in every file and folder from inside your `backend` folder
   (server.js, db.js, gateLogic.js, package.json, the `data` folder,
   etc. — everything inside `backend`, not the `backend` folder
   itself).
5. Scroll down, click **Commit changes**.

### Step 3 — Connect Render to that GitHub repo

1. Go to https://render.com and sign up free (you can sign up using
   your GitHub account directly, which is easiest).
2. Click **New +** → **Web Service**.
3. Choose your `railgate-backend` repository from the list.
4. Fill in:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: choose **Free**
5. Click **Create Web Service**.

Render will now build and start your backend. This takes a few
minutes the first time. When it's done, Render shows you a URL at
the top of the page, something like:
```
https://railgate-backend-abcd.onrender.com
```

**Save this URL** — you'll paste it into the phone app's settings
next (see `frontend/README.md`, Step 2).

### Step 4 — Test the online version

Open that Render URL in your browser, adding `/api/status` to the
end, e.g.:
```
https://railgate-backend-abcd.onrender.com/api/status
```
Same JSON text as before should appear. If it instead takes 30-50
seconds to load the first time, that's normal — the free version of
Render "falls asleep" when nobody's used it for 15 minutes, and takes
a moment to wake up on the next request. After that it's fast again.

---

## How to update your train timings later

Open the file `backend/data/trains.json` in Notepad (or any text
editor). Each train looks like this:

```json
{
  "id": 4,
  "name": "Chennai Beach - Chengalpattu EMU",
  "number": "40513",
  "direction": "towards Chengalpattu (down)",
  "gate_pass_time": "07:15",
  "days": ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
  "close_before_min": 4,
  "open_after_min": 2
}
```

What to change:
- `gate_pass_time`: the time (24-hour clock, like `07:15` for
  7:15 AM, or `18:30` for 6:30 PM) the train passes your actual
  gate — not the station, your gate. If you don't know the exact
  gate time, use the nearest station's time as a close guess.
- `days`: which days it runs. Keep all seven listed for daily trains.
- `close_before_min` / `open_after_min`: how many minutes before/after
  that time the gate is usually down. Start with the numbers already
  there, then adjust after you've watched the real gate a few times
  and noticed it's a bit off.

After saving changes to this file:
- If running locally (Stage 1), stop the backend (`Ctrl+C`) and run
  `npm start` again to reload it.
- If it's online via Render (Stage 2), upload the updated file to
  your GitHub repository (same "upload file" button as before) and
  Render will automatically rebuild itself with the new data within
  a minute or two.

**Reminder:** Indian Railways changes suburban train timetables every
few months. Re-check your train timings occasionally at
indiarailinfo.com or by calling the railway enquiry number, and
update this file — the app is only ever as accurate as what's in it.
