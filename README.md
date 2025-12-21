# NoXcuse

**No excuse. Or fail.**

Simple Pomodoro timer with task management. No fluff, just work.

## Features

- **Pomodoro Timer** - 25-minute focus sessions with flexible breaks (5/15 min or skip)
- **Task Management** - Main tasks with subtasks, drag & drop reorder
- **Backlog** - Store future tasks in sidebar
- **Archive** - Completed tasks grouped by date with restore option
- **Session Tracking** - Daily session counter (green: 1-16 sessions, red: overtime)
- **Calendar** - View session history and completed tasks per date
- **Local Storage** - All data saved in your browser

## Usage

**Online:** https://noxcuse.nairpaa.me

**Build locally:**
```bash
# Clone repo
git clone https://github.com/nairpaa/noxcuse.git
cd noxcuse

# Add assets
cp /path/to/bell-notification.mp3 assets/audio/
cp /path/to/NoXcuse.png assets/icons/

# Build CSS (requires Tailwind CLI)
./tailwindcss -i css/input.css -o css/output.css --minify

# Open index.html
```

## License

This project is open source and available under the [MIT License](LICENSE).

Feel free to use, modify, and distribute. Contributions are welcome!