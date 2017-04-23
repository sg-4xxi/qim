import objectAssign from 'object-assign';

import {updateKey} from './createNavigator';
import {curry2} from './utils/curry';
import {$setKey} from './$set';
import {$defaultKey} from './$default';
import {$navKey} from './$nav';
import {$applyKey} from './$apply';
import $none, {$noneKey, isNone, undefinedIfNone} from './$none';

let continueUpdateEach;
let update;

export const updateEach = (path, object, pathIndex, returnFn, mutationMarker) => {
  if (pathIndex >= path.length) {
    if (returnFn) {
      return returnFn(object);
    }
    return object;
  }
  const nav = path[pathIndex];
  if (!nav || typeof nav === 'string' || typeof nav === 'number' || typeof nav === 'boolean') {
    if (object && typeof object === 'object') {
      const value = object[nav];
      const newValue = updateEach(path, value, pathIndex + 1, returnFn);
      if (isNone(newValue)) {
        if (!(nav in object)) {
          return object;
        }
        if (Array.isArray(object)) {
          const newObject = object.slice(0);
          // Could have a silly edge here where nav was a property and not an index, which means it disappears.
          // If it's still here, that means it's an index.
          if (nav in object) {
            newObject.splice(nav, 1);
          }
          return newObject;
        }
        const newObject = objectAssign({}, object);
        delete newObject[nav];
        return newObject;
      }
      if (value === newValue) {
        return object;
      }
      if (mutationMarker) {
        if (mutationMarker.hasMutated) {
          object[nav] = newValue;
          return object;
        } else {
          mutationMarker.hasMutated = true;
        }
      }
      if (Array.isArray(object)) {
        const newObject = object.slice(0);
        newObject[nav] = newValue;
        return newObject;
      }
      return objectAssign({}, object, {[nav]: newValue});
    } else {
      throw new Error(`cannot update property ${nav} for non-object`);
    }
  }
  if (typeof nav === 'function') {
    if (nav(object)) {
      return updateEach(path, object, pathIndex + 1, returnFn);
    } else {
      return object;
    }
  }
  let updateFn;
  switch (nav['@@qim/nav']) {
    case $applyKey: {
      return updateEach(path, nav.data(object), pathIndex + 1, returnFn);
    }
    case $setKey:
      return updateEach(path, nav.data, pathIndex + 1, returnFn);
    case $defaultKey: {
      if (typeof object === 'undefined') {
        return updateEach(path, nav.data, pathIndex + 1, returnFn);
      }
      return updateEach(path, object, pathIndex + 1, returnFn);
    }
    case $navKey: {
      const navPath = typeof nav.data === 'function' ?
        nav.data(object) :
        nav.data;
      if (navPath == null) {
        return updateEach(path, object, pathIndex + 1, returnFn);
      }
      return updateEach(
        navPath, object, 0,
        (_object) => updateEach(path, _object, pathIndex + 1, returnFn)
      );
    }
    case $noneKey:
      return $none;
  }
  if (nav[updateKey]) {
    updateFn = nav[updateKey];
  } else if (nav['@@qim/nav']) {
    updateFn = nav['@@qim/nav'][updateKey];
  } else if (Array.isArray(nav)) {
    mutationMarker = mutationMarker || {
      hasMutated: false
    };
    const nestedResult = undefinedIfNone(updateEach(nav, object, 0, undefined, mutationMarker));
    return updateEach(path, nestedResult, pathIndex + 1, returnFn, mutationMarker);
  }
  if (!updateFn) {
    throw new Error(`invalid navigator at path index ${pathIndex}`);
  }
  return continueUpdateEach(updateFn, nav, object, path, pathIndex, returnFn);
};

continueUpdateEach = (updateFn, nav, object, path, pathIndex, returnFn) =>
  updateFn(nav, object, (subObject) => updateEach(path, subObject, pathIndex + 1, returnFn), path, pathIndex);

update = function (path, obj) {
  if (!Array.isArray(path)) {
    path = [path];
  }
  return undefinedIfNone(updateEach(path, obj, 0));
};

export default curry2(update);
