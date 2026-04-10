#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(NativeCameraViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(onExerciseUpdate, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(exerciseType, NSString)

@end
