import ManagedSettings
import ManagedSettingsUI
import UIKit

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    override func configuration(shielding application: Application) -> ShieldConfiguration {
        return ShieldConfiguration(
            backgroundBlurStyle: .dark,
            backgroundColor: .black,
            icon: UIImage(named: "AppIcon"),
            title: ShieldConfiguration.Label(text: "DetoxMove: Waktunya Gerak!", color: .white),
            subtitle: ShieldConfiguration.Label(text: "Selesaikan tantangan olahraga untuk membuka aplikasi ini.", color: .lightGray),
            primaryButtonLabel: ShieldConfiguration.Label(text: "Buka DetoxMove", color: .black),
            primaryButtonBackgroundColor: .orange
        )
    }
    
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
        return ShieldConfiguration(
            backgroundBlurStyle: .dark,
            backgroundColor: .black,
            title: ShieldConfiguration.Label(text: "DetoxMove", color: .white),
            subtitle: ShieldConfiguration.Label(text: "Selesaikan tantangan olahraga.", color: .lightGray),
            primaryButtonLabel: ShieldConfiguration.Label(text: "OK", color: .black)
        )
    }
}
