🏆 RefereePro – Sports Tournament Referee Management System

Smart Referee Allocation and Tournament Management

RefereePro is a web-based application that helps tournament organizers manage referees, check their availability, schedule matches, allocate referees automatically or manually, and detect scheduling conflicts before they happen.

Built as a B.Tech Computer Science Engineering project at Lovely Professional University, using only HTML5, CSS3 and vanilla JavaScript. No frameworks, no backend, no installation.

👥 Team
Muskanpreet Kaur
Tezsav Kaur
Sumit Choudary
📌 Problem Statement

Tournament organizers often manage referees with paper lists, chat groups and spreadsheets. This causes:

Difficulty managing many referees
Scheduling conflicts (one referee in two matches at the same time)
Unclear referee availability
Slow manual assignment
No record of previous assignments

RefereePro solves these problems in one simple dashboard.

✨ Features
Module	What it does
Dashboard	Live statistics (referees, matches, available, assigned, conflicts), charts, upcoming matches and recent activity
Referee Management	Add, edit and delete referees. Stores ID, name, contact, email, sport and experience. Searchable table with sport filter
Availability	Add or remove date and time slots, view a day timeline (available / booked / unavailable), and check which referees are free for a chosen match
Match Management	Add, edit and delete matches (name, sport, date, start/end time, venue, ID). Upcoming and completed tabs, search and filter
Allocation	Assign referees to matches automatically (smart allocation) or manually, replace or remove a referee, and see assignment status
Conflict Detection	Blocks overlapping assignments, unavailable referees and sport mismatches before saving, with a clear warning and a log of blocked attempts
Assignment History	Record of every assignment, reassignment and removal with status
Reports	Match-wise, referee-wise and history reports with CSV export

Extras: dark / light mode, responsive layout (desktop, tablet, mobile), toast notifications, confirmation dialogs, form validation, data saved in LocalStorage, and a Reset Demo Data button.

🧠 Allocation Rules
A referee cannot be assigned to two overlapping matches.
A referee cannot be assigned when unavailable.
A match becomes Fully Assigned only when all required referees are assigned.
Conflicts are detected before an assignment is saved.
Organizers can change assignments manually at any time.
Automatic allocation selects only eligible and available referees.
Smart allocation

For each match the system:

Keeps only referees of the same sport
Checks their availability slot covers the match time
Removes anyone with an overlapping match
Ranks the rest by score:
score = experience × 2 − upcoming matches × 4

Experienced referees with a lighter workload are chosen first, which keeps assignments fair.

🛠️ Tech Stack
HTML5 – structure, forms, semantic layout
CSS3 – navy theme, dark mode, grid/flexbox, animations, responsive design
JavaScript (ES6) – all logic: validation, allocation, conflict detection, rendering
LocalStorage – data stays saved after refreshing the page
📁 Project Structure
referee-management-system/
├── index.html   # Layout, 8 pages, popup forms
├── style.css    # Theme, dark mode, responsive styles
├── script.js    # Data, allocation rules, conflict checks, UI logic
└── README.md
🚀 How to Run
Option 1: VS Code Live Server (recommended)
Download or clone this repository.
Open the folder in VS Code.
Install the Live Server extension (Ritwick Dey).
Right-click index.html and choose Open with Live Server.
The site opens at http://127.0.0.1:5500.
Option 2: Open directly

Double-click index.html to open it in any modern browser.

🎬 Demo Walkthrough
Open the Dashboard and review the statistics.
Referees → Add a new referee (the form validates every field).
Availability → Add a date and time slot for that referee.
Matches → Add a new match.
Allocation → Click ⚡ Auto or Auto-Allocate All.
Try assigning a referee who is already busy to see the conflict warning.
Check History, then download a CSV from Reports.

Sample data (12 referees, 16 matches across 6 sports) loads on first run. Dates are generated relative to today, so there are always upcoming and completed matches. Use ↺ Reset Demo Data to restore it.

💾 Data Storage

All data is stored in your browser's LocalStorage, so it stays on your device and survives page refresh. It is not shared between browsers or devices.

🔮 Future Scope
Backend database and user login
Email / SMS notifications for referees
Referee self-service availability
Mobile app version
🌐 Host on GitHub Pages
Create a new repository on GitHub and upload all files.
Go to Settings → Pages.
Under Branch, choose main and / (root), then click Save.
After a minute your site is live at https://<your-username>.github.io/<repository-name>/.
📄 License

This project was created for educational purposes as part of a B.Tech academic pro# Sports-Referee-Management-System
