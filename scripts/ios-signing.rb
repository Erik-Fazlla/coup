# Sets manual release signing on the app target, for the CI build only.
#
# Run by .github/workflows/build-ios.yml on the macOS runner, after `pod install`:
#   bundle exec ruby scripts/ios-signing.rb
#
# The values come from the provisioning profile and certificate stored in GitHub
# Secrets (see docs/ios-build.md). Nothing here is committed: the runner's copy
# of the project is thrown away with the runner.
#
# Only the "Coup" target is touched. Passing the same settings on the xcodebuild
# command line would also apply them to every CocoaPods target, which fails.

require 'xcodeproj'

TARGET = 'Coup'
CONFIGURATION = 'Release'

def setting(name)
  value = ENV[name].to_s.strip
  abort "ios-signing: #{name} is not set" if value.empty?
  value
end

team = setting('IOS_TEAM_ID')
profile = setting('IOS_PROFILE_NAME')
bundle_id = setting('IOS_BUNDLE_ID')
identity = setting('IOS_SIGN_IDENTITY')
build_number = setting('IOS_BUILD_NUMBER')

path = File.expand_path('../ios/Coup.xcodeproj', __dir__)
project = Xcodeproj::Project.open(path)
target = project.targets.find { |candidate| candidate.name == TARGET }
abort "ios-signing: no target named #{TARGET} in #{path}" unless target

config = target.build_configurations.find { |candidate| candidate.name == CONFIGURATION }
abort "ios-signing: target #{TARGET} has no #{CONFIGURATION} configuration" unless config

settings = config.build_settings
settings['CODE_SIGN_STYLE'] = 'Manual'
settings['DEVELOPMENT_TEAM'] = team
settings['PROVISIONING_PROFILE_SPECIFIER'] = profile
settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
settings['CODE_SIGN_IDENTITY'] = identity
# The project sets this one per SDK ("iPhone Developer"); the per-SDK value would win over the plain one.
settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = identity
settings['CURRENT_PROJECT_VERSION'] = build_number

project.save
puts "ios-signing: #{TARGET} (#{CONFIGURATION}) signs as #{bundle_id}, build #{build_number}"
