package com.detoxmove

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewProps

import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.bridge.ReadableArray

class NativeCameraViewManager : SimpleViewManager<NativeCameraView>() {

    override fun getName(): String {
        return "NativeCameraView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): NativeCameraView {
        return NativeCameraView(reactContext)
    }

    @ReactProp(name = "thresholdDown")
    fun setThresholdDown(view: NativeCameraView, value: Double) {
        view.setThresholdDown(value)
    }

    @ReactProp(name = "thresholdUp")
    fun setThresholdUp(view: NativeCameraView, value: Double) {
        view.setThresholdUp(value)
    }

    @ReactProp(name = "maxVerticalDiff")
    fun setMaxVerticalDiff(view: NativeCameraView, value: Double) {
        view.setMaxVerticalDiff(value)
    }

    @ReactProp(name = "workoutMode")
    fun setWorkoutMode(view: NativeCameraView, value: String) {
        view.setWorkoutMode(value)
    }

    override fun getCommandsMap(): Map<String, Int> {
        return mapOf("resetCounter" to 1)
    }

    override fun receiveCommand(view: NativeCameraView, commandId: String, args: ReadableArray?) {
        if (commandId == "resetCounter" || commandId == "1") {
            view.resetCounter()
        }
    }
}
