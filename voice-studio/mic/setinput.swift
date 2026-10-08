// Sets the default input device of macOS to the microphone whose name contains the given text. Without an argument: lists all input devices.
// Build (once):  swiftc -O voice-studio/mic/setinput.swift -o voice-studio/mic/setinput
// Use:           voice-studio/mic/setinput "USB"       (part of the name is enough; the `setinput` binary is not checked in)
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

// Does the device have at least one input channel? (Speakers and output-only devices drop out.)
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
    print("Input devices (pass the name or part of it as an argument):")
    inputs.forEach { print("  \(name($0))") }
    exit(0)
}
let want = CommandLine.arguments[1]
guard let target = inputs.first(where: { name($0).localizedCaseInsensitiveContains(want) }) else {
    print("No input device matching \"\(want)\" found. Available:")
    inputs.forEach { print("  \(name($0))") }
    exit(1)
}
var dev = target
var d = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
let r = AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &d, 0, nil, UInt32(MemoryLayout<AudioDeviceID>.size), &dev)
print(r == 0 ? "Default input: \(name(target))" : "Error \(r)")
exit(r == 0 ? 0 : 1)
