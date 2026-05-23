-- Focus a specific Warp tab by matching the project directory or running process in the title.
-- Warp exposes each tab as a separate "window" in System Events.
-- Usage: osascript focus-warp-tab.applescript <projectHint> <agentCwd>
--
-- projectHint:  Directory basename to match (e.g. "agents-visual")
-- agentCwd:     Full working directory path (e.g. "/Users/dan/projects/agents-visual")
--
-- Tries multiple matching strategies in order:
--   1. Tab title contains the project hint (directory basename)
--   2. Tab title contains the full cwd path
--   3. Tab title contains "claude" (the running agent process)
--
-- Returns: "focused:<windowTitle>" or "activated"

on run argv
	set projectHint to item 1 of argv
	set agentCwd to item 2 of argv

	tell application "Warp" to activate
	delay 0.2

	try
		tell application "System Events"
			tell process "Warp"
				set windowList to every window

				-- Pass 1: match project directory name in title
				if projectHint is not "" then
					repeat with w in windowList
						set winTitle to name of w
						if winTitle contains projectHint then
							perform action "AXRaise" of w
							return "focused:" & winTitle
						end if
					end repeat
				end if

				-- Pass 2: match full cwd path
				if agentCwd is not "" then
					repeat with w in windowList
						set winTitle to name of w
						if winTitle contains agentCwd then
							perform action "AXRaise" of w
							return "focused:" & winTitle
						end if
					end repeat
				end if

				-- Pass 3: match "claude" (running agent process)
				repeat with w in windowList
					set winTitle to name of w
					if winTitle contains "claude" then
						perform action "AXRaise" of w
						return "focused:" & winTitle
					end if
				end repeat

			end tell
		end tell
	on error errMsg
		return "activated:system-events-error"
	end try

	return "activated"
end run
