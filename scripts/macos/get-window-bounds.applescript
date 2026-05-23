-- Get position and size of a specific window by title substring.
-- Usage: osascript get-window-bounds.applescript <processName> <titleSubstring>
--
-- Returns: JSON object with title, index, x, y, width, height — or "null" if not found.

on run argv
	set processName to item 1 of argv
	set titleMatch to item 2 of argv

	try
		tell application "System Events"
			tell process processName
				set windowList to every window
				repeat with i from 1 to count of windowList
					set w to item i of windowList
					set winTitle to name of w
					if winTitle contains titleMatch then
						set winPos to position of w
						set winSize to size of w
						set escapedTitle to my replaceText(winTitle, "\"", "\\\"")
						return "{\"title\":\"" & escapedTitle & "\",\"index\":" & i & ",\"x\":" & (item 1 of winPos) & ",\"y\":" & (item 2 of winPos) & ",\"width\":" & (item 1 of winSize) & ",\"height\":" & (item 2 of winSize) & "}"
					end if
				end repeat
			end tell
		end tell
	on error errMsg
		return "null"
	end try

	return "null"
end run

on replaceText(sourceText, searchString, replacementString)
	set AppleScript's text item delimiters to searchString
	set textItems to every text item of sourceText
	set AppleScript's text item delimiters to replacementString
	set resultText to textItems as text
	set AppleScript's text item delimiters to ""
	return resultText
end replaceText
