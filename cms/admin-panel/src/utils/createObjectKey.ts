export const createObjectKeyMap = () => {
  const ids = new WeakMap();

  return {
    get: function createObjectKey(object: object) {
      let key = ids.get(object);
      if (!key) {
        key = Math.random().toString(36).slice(2, 10);
        ids.set(object, key);
      }
      return key;
    },
  };
};
