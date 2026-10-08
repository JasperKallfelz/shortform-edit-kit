// Setzt das Standard-Eingabegerät von macOS auf das Mikrofon, dessen Name den übergebenen Text enthält. Ohne Argument: Liste aller Eingabegeräte.
// Bauen (einmalig):  swiftc -O voice-studio/mikro/setinput.swift -o voice-studio/mikro/setinput
// Benutzen:          voice-studio/mikro/setinput "USB"       (Teil des Namens genügt; die Datei `setinput` wird nicht eingecheckt)
import CoreAudio
import Foundation

var size: UInt32 = 0
var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size)
var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &ids)

func name(_ id: AudioDeviceID) -> String {
    var a = AudioObjectPropertyAddress(mSelector: kAudioObjectPropertyName, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var n: Unmanaged<CFString>?
    var s = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    AudioObjectGetPropertyData(id, &a, 0, nil, &s, &n)
    return (n?.takeRetainedValue() as String?) ?? ""
}

// Hat das Gerät mindestens einen Eingabekanal? (Lautsprecher und reine Ausgabegeräte fallen weg.)
func hasInput(_ id: AudioDeviceID) -> Bool {
    var a = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreamConfiguration, mScope: kAudioDevicePropertyScopeInput, mElement: kAudioObjectPropertyElementMain)
    var s: UInt32 = 0
    AudioObjectGetPropertyDataSize(id, &a, 0, nil, &s)
    let buf = UnsafeMutableRawPointer.allocate(byteCount: Int(s), alignment: 8)
    defer { buf.deallocate() }
    AudioObjectGetPropertyData(id, &a, 0, nil, &s, buf)
    let list = buf.assumingMemoryBound(to: AudioBufferList.self)
    return UnsafeMutableAudioBufferListPointer(list).reduce(0) { $0 + Int($1.mNumberChannels) } > 0
}

let inputs = ids.filter(hasInput)
guard CommandLine.arguments.count > 1 else {
    print("Eingabegeräte (Name oder Teil davon als Argument übergeben):")
    inputs.forEach { print("  \(name($0))") }
    exit(0)
}
let want = CommandLine.arguments[1]
guard let target = inputs.first(where: { name($0).localizedCaseInsensitiveContains(want) }) else {
    print("Kein Eingabegerät mit \"\(want)\" gefunden. Vorhanden:")
    inputs.forEach { print("  \(name($0))") }
    exit(1)
}
var dev = target
var d = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
let r = AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &d, 0, nil, UInt32(MemoryLayout<AudioDeviceID>.size), &dev)
print(r == 0 ? "Standard-Eingabe: \(name(target))" : "Fehler \(r)")
exit(r == 0 ? 0 : 1)
