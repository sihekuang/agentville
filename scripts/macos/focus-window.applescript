-- Focus a specific application window by matching the project name in the title.
-- Usage: osascript focus-window.applescript <appName> <processName> <projectHint>
--
-- appName:      The application name for `tell application` (e.g. "Visual Studio Code")
-- processName:  The System Events process name (e.g. "Code")
-- projectHint:  A substring to match in window titles (e.g. "agents-visual"). Empty string to skip matching.
--
-- Returns: "focused:<windowTitle>" if a matching window was raised,
--          "activated" if the app was brought forward without window matching.

on run argv
	set appName to item 1 of argv
	set processName to item 2 of argv
	set projectHint to item 3 of argv

	tell application appName to activate

	if projectHint is "" then return "activated"

	delay 0.15

	try
		tell application "System Events"
			tell process processName
				set windowList to every window
				repeat with w in windowList
					set winTitle to name of w
					if winTitle contains projectHint then
						perform action "AXRaise" of w
						return "focused:" & winTitle
					end if
				end repeat
			end tell
		end tell
	on error errMsg
		-- System Events access might be denied; fall back to simple activation
		return "activated:system-events-error"
	end try

	return "activated"
end run
