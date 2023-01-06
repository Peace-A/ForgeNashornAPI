function getProxy(str) {
  var data = JSON.parse(str);
  var Proxy = {
    type: function (classPath) {
      var javaObject = Java.type(classPath);
      var needsSuperClasses = [];
      var selectedClass = javaObject.class;
      while (selectedClass !== null) {
        var className = selectedClass.getName();
        if (data[className]) needsSuperClasses.push(className);
        selectedClass = selectedClass.getSuperclass();
      }
      if (needsSuperClasses.length === 0) return javaObject;
      var result = {};
      for (var i in needsSuperClasses) {
        var className = needsSuperClasses[i];
        var handler = data[className];
        for (var name in handler.fields) {
          var encryptedName = handler.fields[name];
          Object.defineProperty(result, name, {
            get: (function (name) {
              return function () {
                return Proxy.create(javaObject[name]);
              };
            })(encryptedName),
            set: (function (name) {
              return function (val) {
                return (javaObject[name] = val);
              };
            })(encryptedName),
          });
        }
        result._native = javaObject;
        for (var name in handler.funcs) {
          var encryptedName = handler.funcs[name];
          result[name] = (function (name) {
            return function () {
              return Proxy.create(
                eval(
                  "javaObject[name](" +
                    Array.prototype.slice
                      .call(arguments)
                      .map(function (n, i) {
                        return "arguments[" + i + "]";
                      })
                      .join(",") +
                    ")"
                )
              );
            };
          })(encryptedName);
        }
      }
      return result;
    },
    create: function (javaObject) {
      if (!javaObject.getClass) return javaObject;
      var needsSuperClasses = [];
      var selectedClass = javaObject.getClass();
      while (selectedClass !== null) {
        var className = selectedClass.getName();
        if (data[className]) needsSuperClasses.push(className);
        selectedClass = selectedClass.getSuperclass();
      }
      if (needsSuperClasses.length === 0) return javaObject;
      var result = {};
      for (var i in needsSuperClasses) {
        var className = needsSuperClasses[i];
        var handler = data[className];
        for (var name in handler.fields) {
          var encryptedName = handler.fields[name];
          try {
            Object.defineProperty(result, name, {
              get: (function (name) {
                return function () {
                  return Proxy.create(javaObject[name]);
                };
              })(encryptedName),
              set: (function (name) {
                return function (val) {
                  return (javaObject[name] = val);
                };
              })(encryptedName),
            });
          } catch (e) {}
        }
        result._native = javaObject;
        for (var name in handler.funcs) {
          var encryptedName = handler.funcs[name];
          result[name] = (function (name) {
            return function () {
              return Proxy.create(
                eval(
                  "javaObject[name](" +
                    Array.prototype.slice
                      .call(arguments)
                      .map(function (n, i) {
                        return "arguments[" + i + "]";
                      })
                      .join(",") +
                    ")"
                )
              );
            };
          })(encryptedName);
        }
      }
      return result;
    },
  };
  return Proxy;
}
