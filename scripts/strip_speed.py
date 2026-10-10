import re

with open('popup/popup.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove from elements object
code = re.sub(r'  // Speed Picker\n.*?speedHintText: document\.getElementById\(\'speedHintText\'\),\n', '', code, flags=re.DOTALL)
code = re.sub(r'  confirmSpeedRow: document\.getElementById\(\'confirmSpeedRow\'\),\n  confirmSpeed: document\.getElementById\(\'confirmSpeed\'\),\n', '', code, flags=re.DOTALL)

# Remove from appState
code = re.sub(r'  playbackSpeed: 1\.0,\n', '', code, flags=re.DOTALL)
code = re.sub(r'  appState\.playbackSpeed = plan\.playbackSpeed \|\| 1\.0;\n', '', code, flags=re.DOTALL)
code = re.sub(r'  appState\.playbackSpeed = 1\.0;\n', '', code, flags=re.DOTALL)

# Modify plannerNextBtn
code = re.sub(r"    appState\.wizardStep = 'speed-picker';\n    renderUI\(\);\n  \}\);(.*?)  // Mode Picker Next", r"    handleGeneratePlan();\n  });\1  // Mode Picker Next", code, flags=re.DOTALL)

# Modify modePickerNextBtn
code = re.sub(r"    \} else \{\n      appState\.wizardStep = 'speed-picker';\n    \}\n    renderUI\(\);\n  \}\);", r"    } else {\n      handleGeneratePlan();\n    }\n  });", code, flags=re.DOTALL)

# Remove speed picker event listeners and variables
code = re.sub(r"  // Speed Picker Back & Next\n.*?function updateSpeedHint\(\) \{\n.*?\}\n", '', code, flags=re.DOTALL)

# Remove hide/show sections for speedPicker
code = re.sub(r'      hideSection\(elements\.speedPickerSection\);\n', '', code, flags=re.DOTALL)
code = re.sub(r'  hideSection\(elements\.speedPickerSection\);\n', '', code, flags=re.DOTALL)
code = re.sub(r"    \} else if \(appState\.wizardStep === 'speed-picker'\) \{\n.*?    \} else if \(appState\.wizardStep === 'confirm'\) \{", r"    } else if (appState.wizardStep === 'confirm') {", code, flags=re.DOTALL)

# Remove confirm section speed rows
code = re.sub(r"      if \(appState\.mode === 'custom'\) \{\n        showSection\(elements\.confirmDailyTimeRow\);\n        elements\.confirmDailyTime\.textContent = appState\.dailyWatchTime \+ ' mins/day';\n        hideSection\(elements\.confirmSpeedRow\);\n      \} else \{\n        hideSection\(elements\.confirmDailyTimeRow\);\n        showSection\(elements\.confirmSpeedRow\);\n      \}\n      elements\.confirmSpeed\.textContent = appState\.playbackSpeed \+ 'x';\n", r"      if (appState.mode === 'custom') {\n        showSection(elements.confirmDailyTimeRow);\n        elements.confirmDailyTime.textContent = appState.dailyWatchTime + ' mins/day';\n      } else {\n        hideSection(elements.confirmDailyTimeRow);\n      }\n", code, flags=re.DOTALL)

# Modify handleGeneratePlan
code = re.sub(r"    const speed = appState\.playbackSpeed \|\| 1\.0;\n", "    const speed = 1.0;\n", code, flags=re.DOTALL)
code = re.sub(r"      playbackSpeed: appState\.mode === 'video-by-video' \? null : speed,\n", "", code, flags=re.DOTALL)

with open('popup/popup.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("done")
