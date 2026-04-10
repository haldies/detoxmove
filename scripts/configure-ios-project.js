const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const projectPath = 'ios/DetoxMove.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parse(function (err) {
    if (err) {
        console.error('Error parsing project:', err);
        return;
    }

    console.log('Targets:', myProj.hash.project.objects.PBXNativeTarget);
    
    // Find the main app target
    const targets = myProj.hash.project.objects.PBXNativeTarget;
    let mainTarget;
    for (let key in targets) {
        if (key.indexOf('_comment') === -1) {
            mainTarget = key;
            break;
        }
    }

    if (!mainTarget) {
        console.error('Target not found!');
        return;
    }
    
    console.log('Using Target:', mainTarget);

    // Find the DetoxMove group UUID
    const groups = myProj.hash.project.objects.PBXGroup;
    let mainGroupUuid;
    for (let key in groups) {
        if (typeof groups[key] === 'object' && groups[key].name === 'DetoxMove') {
            mainGroupUuid = key;
            break;
        }
    }

    if (!mainGroupUuid) {
        // Fallback to searching by path if name not found
        for (let key in groups) {
            if (typeof groups[key] === 'object' && groups[key].path === 'DetoxMove') {
                mainGroupUuid = key;
                break;
            }
        }
    }

    if (!mainGroupUuid) {
        console.error('DetoxMove group not found! Using root group.');
        mainGroupUuid = myProj.getFirstProject().firstProject.mainGroup;
    }

    console.log('Using Group UUID:', mainGroupUuid);
    
    // 1. Files to add to "Sources" (Swift & ObjC)
    const sourceFiles = [
        'DetoxService.swift',
        'DetoxService.m',
        'WalkingSessionManager.swift',
        'NativeCameraView.swift',
        'NativeCameraViewManager.swift',
        'NativeCameraViewManager.m',
        'ExerciseCounters.swift',
        'PoseLandmarkerHelper.swift'
    ];

    sourceFiles.forEach(file => {
        const filePath = 'DetoxMove/' + file;
        if (!myProj.hasFile(filePath)) {
            console.log('Adding source:', file);
            const fileObj = myProj.addFile(filePath, mainGroupUuid);
            if (fileObj) {
                fileObj.target = mainTarget;
                myProj.addToPbxSourcesBuildPhase(fileObj);
            }
        } else {
            console.log('Source already exists:', file);
        }
    });

    // 2. Resources (AI Model)
    const modelPath = 'DetoxMove/pose_landmarker_lite.task';
    if (!myProj.hasFile(modelPath)) {
        console.log('Adding resource: pose_landmarker_lite.task');
        const resObj = myProj.addFile(modelPath, mainGroupUuid);
        if (resObj) {
            resObj.target = mainTarget;
            myProj.addToPbxResourcesBuildPhase(resObj);
        }
    }

    // 3. Header & Entitlements
    if (!myProj.hasFile('DetoxMove/DetoxMove-Bridging-Header.h')) {
        myProj.addFile('DetoxMove/DetoxMove-Bridging-Header.h', mainGroupUuid);
    }
    if (!myProj.hasFile('DetoxMove/DetoxMove.entitlements')) {
        myProj.addFile('DetoxMove/DetoxMove.entitlements', mainGroupUuid);
    }

    // 4. Build Settings
    console.log('Setting build properties');
    myProj.addBuildProperty('PRODUCT_BUNDLE_IDENTIFIER', 'com.detoxmove.app', 'Debug');
    myProj.addBuildProperty('PRODUCT_BUNDLE_IDENTIFIER', 'com.detoxmove.app', 'Release');
    myProj.addBuildProperty('SWIFT_OBJC_BRIDGING_HEADER', '"DetoxMove/DetoxMove-Bridging-Header.h"', 'Debug');
    myProj.addBuildProperty('SWIFT_OBJC_BRIDGING_HEADER', '"DetoxMove/DetoxMove-Bridging-Header.h"', 'Release');
    myProj.addBuildProperty('CODE_SIGN_ENTITLEMENTS', 'DetoxMove/DetoxMove.entitlements', 'Debug');
    myProj.addBuildProperty('CODE_SIGN_ENTITLEMENTS', 'DetoxMove/DetoxMove.entitlements', 'Release');
    myProj.addBuildProperty('SWIFT_VERSION', '5.0', 'Debug');
    myProj.addBuildProperty('SWIFT_VERSION', '5.0', 'Release');
    
    // Save
    fs.writeFileSync(projectPath, myProj.writeSync());
    console.log('Successfully configured iOS project.');
});
