-- Focus a specific Warp tab by cycling through tabs and matching the title.
-- Warp exposes only ONE window to System Events — tabs are not separate windows.
-- So we cycle tabs with Cmd+Shift+] and check the window title after each switch.
--
-- Usage: osascript focus-warp-tab.applescript <projectHint> <agentCwd>
--
-- projectHint:  Directory basename to match (e.g. "agents-visual")
-- agentCwd:     Full working directory path as fallback match
--
-- Returns: "focused:<windowTitle>" or "activated"

on run argv
	set projectHint to item 1 of argv
	set agentCwd to item 2 of argv

	tell application "Warp" to activate
	delay 0.2

	if projectHint is "" and agentCwd is "" then return "activated"

	try
		tell application "System Events"
			tell process "Warp"
				set startTitle to name of window 1

				if my titleMatches(startTitle, projectHint, agentCwd) then
					return "focused:" & startTitle
				end if

				repeat 20 times
					keystroke "]" using {command down, shift down}
					delay 0.15
					set currentTitle to name of window 1

					if currentTitle is startTitle then
						return "activated"
					end if

					if my titleMatches(currentTitle, projectHint, agentCwd) then
						return "focused:" & currentTitle
					end if
				end repeat
			end tell
		end tell
	on error errMsg
		return "activated:system-events-error"
	end try

	return "activated"
end run

on titleMatches(winTitle, projectHint, agentCwd)
	if projectHint is not "" and winTitle contains projectHint then return true
	if agentCwd is not "" and winTitle contains agentCwd then return true
	return false
end titleMatches
