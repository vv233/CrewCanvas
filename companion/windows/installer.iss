; Inno Setup script for the CrewCanvas Companion Windows installer.
; Produces a self-contained setup.exe (no prerequisites) when a portable Node is
; bundled. Build on Windows with: ISCC installer.iss   (Inno Setup 6+).
;
; Before building, from the companion/ folder:
;   1. npm install                      (so node_modules/ exists with pptxgenjs)
;   2. (recommended) download a Windows portable Node and extract node.exe
;      (plus its files) into companion\windows\node\ so the installer is
;      self-contained. If you skip this, the app falls back to a Node on PATH.

#define AppName "CrewCanvas Companion"
#define AppVersion "0.1.0"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\CrewCanvas Companion
DefaultGroupName=CrewCanvas Companion
OutputBaseFilename=crewcanvas-companion-setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
DisableProgramGroupPage=yes

[Files]
Source: "..\server.mjs";   DestDir: "{app}"; Flags: ignoreversion
Source: "..\package.json";  DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md";     DestDir: "{app}"; Flags: ignoreversion
Source: "run-companion.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Flags: recursesubdirs createallsubdirs
; Optional bundled portable Node — included only if windows\node\ exists.
Source: "node\*"; DestDir: "{app}\node"; Flags: recursesubdirs createallsubdirs skipifsourcedoesntexist

[Icons]
Name: "{group}\CrewCanvas Companion"; Filename: "{app}\run-companion.bat"
Name: "{autodesktop}\CrewCanvas Companion"; Filename: "{app}\run-companion.bat"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"

[Run]
Filename: "{app}\run-companion.bat"; Description: "Start the Companion now"; Flags: postinstall nowait skipifsilent
