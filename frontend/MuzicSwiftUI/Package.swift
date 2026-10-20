// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "MuzicSwiftUI",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "MuzicSwiftUI", targets: ["MuzicSwiftUI"])
    ],
    targets: [
        .executableTarget(
            name: "MuzicSwiftUI"
        )
    ]
)
