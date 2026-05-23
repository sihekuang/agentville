-- List all windows for a given application via System Events.
-- Usage: osascript list-windows.applescript <processName>
--
-- Returns: JSON array of window objects with title, index, position, and size.
-- Example: [{"title":"my-project","index":1,"x":0,"y":25,"width":1440,"height":875}]

on run argv
	set processName to item 1 of argv
	set jsonParts to {}

	try
		tell application "System Events"
			tell process processName
				set windowList to every window
				set windowCount to count of windowList
				repeat with i from 1 to windowCount
					set w to item i of windowList
					set winTitle to name of w
					set winPos to position of w
					set winSize to size of w

					-- Escape double quotes in title
					set escapedTitle to my replaceText(winTitle, "\"", "\\\"")

					set jsonObj to "{\"title\":\"" & escapedTitle & "\",\"index\":" & i & ",\"x\":" & (item 1 of winPos) & ",\"y\":" & (item 2 of winPos) & ",\"width\":" & (item 1 of winSize) & ",\"height\":" & (item 2 of winSize) & "}"
					set end of jsonParts to jsonObj
				end repeat
			end tell
		end tell
	on error errMsg
		return "[]"
	end try

	if (count of jsonParts) is 0 then return "[]"

	set jsonArray to "["
	repeat with i from 1 to count of jsonParts
		if i > 1 then set jsonArray to jsonArray & ","
		set jsonArray to jsonArray & (item i of jsonParts)
	end repeat
	set jsonArray to jsonArray & "]"

	return jsonArray
end run

on replaceText(sourceText, searchString, replacementString)
	set AppleScript's text item delimiters to searchString
	set textItems to every text item of sourceText
	set AppleScript's text item delimiters to replacementString
	set resultText to textItems as text
	set AppleScript's text item delimiters to ""
	return resultText
end replaceText
