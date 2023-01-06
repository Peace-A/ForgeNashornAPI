const parse = require("java-parser").parse;
const {
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  unlinkSync,
} = require("fs");
const { resolve, join, extname } = require("path");

const reduceAssign = (o1, o2) => Object.assign(o1, o2);
// use cache because jd-cli and java-parser
// may conflicts and you must fix it
// and cache saved to file so with cache
// next run programm be faster
let cache = {};
try {
  cache = JSON.parse(readFileSync("build/cache.json").toString());
} catch (e) {}
function writeCache() {
  writeFileSync("build/cache.json", JSON.stringify(cache));
}

const FORGE_MAP_DIR = "./build/forgemap/";
const FORGE_SRG_DIR = "./build/forgesrg/";
const JAR_OUTPUT_DIR = "./build/jar";
const JSON_CONVERTOR_FILE_PATH = join(JAR_OUTPUT_DIR, "data.json");
const MAIN_JAVA_FILE_DIR = join(JAR_OUTPUT_DIR, "me/peace/nashornapi");
const MAIN_JAVA_FILE_PATH = join(MAIN_JAVA_FILE_DIR, "Api.java");
const JAR_RESULT_FILE = resolve(
  "./build",
  `${process.env.npm_package_name}-${process.env.npm_package_version}.jar`
);
const JAVA_HOME_BIN = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin") : "";
const JAVAC = join(JAVA_HOME_BIN, "javac");
const JAR = join(JAVA_HOME_BIN, "jar");

void (function main() {
  const convertorJson = assignSimpliestData(
    recursiveParseForge(FORGE_MAP_DIR),
    recursiveParseForge(FORGE_SRG_DIR)
  );
  prepareJarDirectory(MAIN_JAVA_FILE_DIR);
  prepareMainJavaFile(MAIN_JAVA_FILE_PATH);
  prepareJsonConvertor(convertorJson, JSON_CONVERTOR_FILE_PATH);
  compileToJar(JAR_OUTPUT_DIR, MAIN_JAVA_FILE_PATH);
  console.log("OK!");
})();

function compileToJar(dir, ...files) {
  const { execSync } = require("child_process");
  files.map((path) => {
    execSync(`${JAVAC} ${path}`);
    unlinkSync(path);
  });
  execSync(`cd ${dir} && ${JAR} cvf ${JAR_RESULT_FILE} *`);
}

function prepareJsonConvertor(convertorJson, path) {
  writeFileSync(path, JSON.stringify(convertorJson));
}

function prepareMainJavaFile(path) {
  writeFileSync(
    path,
    readFileSync("./Api.java")
      .toString()
      .replace(
        "{js}",
        readFileSync("java.js")
          .toString()
          .replaceAll("\n", "\\n")
          .replaceAll('"', '\\"')
      )
  );
}

function prepareJarDirectory(dir) {
  mkdirSync(dir, { recursive: true });
}

// assign de-encrypted(forgeMap)
// and encrypted(forgeSrg)
// names of fields and funcs
// turn 2 arrays into 1 object
// example:
// forgeMap: {
//		"net.minecraft.world.IPosition": [
//			x,
//			...
//			getX,
//			...
//		]
// }
// forgeSrg: {
//		"net.minecraft.world.IPosition": [
//			field_4djj92s,
//			...
//			func_2343dw2,
//			...
//		]
// }
// return {
//		"net.minecraft.world.IPosition": {
//			x: field_4djj92s,
//			...
//			getX: func_2343dw2,
//			...
//		}
// }
function assignSimpliestData(forgeMap, forgeSrg) {
  writeCache();
  const forgeMapKeys = Object.keys(forgeMap);

  return forgeMapKeys
    .map((packagePath) => {
      return {
        [packagePath]: {
          fields: forgeMap[packagePath].fields
            .map((name, i) => {
              return {
                [name]: forgeSrg[packagePath]
                  ? forgeSrg[packagePath].fields[i]
                  : null,
              };
            })
            .reduce(reduceAssign, {}),

          funcs: forgeMap[packagePath].funcs
            .map((name, i) => {
              return {
                [name]: forgeSrg[packagePath]
                  ? forgeSrg[packagePath].funcs[i]
                  : null,
              };
            })
            .reduce(reduceAssign, {}),
        },
      };
    })
    .reduce(reduceAssign, {});
}

// must carry path of directory
// of decompiled by jd-cli
// forge-srg or forge-mapped
// return assigned simplest data from
// all .java files of forge
function recursiveParseForge(path) {
  const files = readdirSync(path);
  const simpliestDataOfDirs = files
    .filter((name) => statSync(join(path, name)).isDirectory())
    .map((name) => recursiveParseForge(join(path, name)));
  return files
    .filter((name) => extname(name) === ".java")
    .map((name) => {
      const fullPath = join(path, name);
      if (cache[fullPath]) return cache[fullPath];
      const data = readBrokenJavaFile(join(path, name));
      let parsed;
      try {
        parsed = parse(data);
      } catch (e) {
        writeCache();
        throw `${data} \n ${
          data
            .split("\n")
            .slice(
              parseInt(e.toString().slice(e.toString().indexOf("line:") + 5)) -
                1
            )[0]
        }\n File ${join(path, name)} has error in code: ${e}`;
      }
      cache[fullPath] = getSimpliestData(parsed);
      return cache[fullPath];
    })
    .concat(simpliestDataOfDirs)
    .reduce(reduceAssign, {});
}

// turn java-parser parsed data
// into simpliest json object of
// struct of java file
function getSimpliestData(parsed) {
  const result = {};

  const body = parsed.children.ordinaryCompilationUnit[0].children;

  // get package name example: net.minecraft.world
  const typePath = body.packageDeclaration[0].children.Identifier.map(
    (e) => e.image
  ).join(".");

  // .java file without class, enum or interface
  if (!body.typeDeclaration) return {};

  let type = body.typeDeclaration[0].children;
  if (type.classDeclaration) {
    type = type.classDeclaration[0].children;
  } else if (type.interfaceDeclaration) {
    type = type.interfaceDeclaration[0].children;
  }

  let typeFullName;
  if (type.normalClassDeclaration) {
    typeFullName = typePath + "." + getTypeName(type.normalClassDeclaration);
    result[typeFullName] = parseType(
      type.normalClassDeclaration[0].children.classBody
    );
  } else if (type.enumDeclaration) {
    typeFullName = typePath + "." + getTypeName(type.enumDeclaration);
    result[typeFullName] = parseType(
      type.enumDeclaration[0].children.enumBody[0].children.enumBodyDeclarations
    );
  } else if (type.normalInterfaceDeclaration) {
    typeFullName =
      typePath + "." + getTypeName(type.normalInterfaceDeclaration);
    result[typeFullName] = parseType(type.normalInterfaceDeclaration);
  } else if (type.interfaceModifier) {
    // do nothing
    // because interface modifiers
    // is not used in nashorn
  } else throw type;

  if (typeFullName) console.log("working with", typeFullName);

  return result;

  // get name of class, enum or interface
  function getTypeName(type) {
    return type[0].children.typeIdentifier[0].children.Identifier[0].image;
  }

  // parse class, enum or interface
  function parseType(type) {
    const defaultResult = {
      fields: [],
      funcs: [],
    };

    // type[0].name = classBody or classBodyDeclarations
    if (type[0].children.classBodyDeclaration) {
      var body = type[0].children.classBodyDeclaration
        .filter((e) => !!e.children.classMemberDeclaration)
        .map((e) => e.children.classMemberDeclaration[0]);
    } else if (type[0].children.interfaceBody) {
      var body =
        type[0].children.interfaceBody[0].children.interfaceMemberDeclaration;
      // if interface is empty
      if (body === undefined) return defaultResult;
    }
    // if class or enum is empty
    else {
      // check types
      if (type[0].name === "classBody") {
        return defaultResult;
      } else if (type[0].name === "enumBodyDeclarations") {
        return defaultResult;
      }
      // undefined type? throw error
      else throw type;
    }

    const fields = body
      .filter(
        (e) =>
          !!e.children.fieldDeclaration ||
          !!e.children.interfaceFieldDeclaration
      )
      .map(
        (e) =>
          (e.children.fieldDeclaration ||
            e.children.interfaceFieldDeclaration)[0].children
            .variableDeclaratorList[0].children.variableDeclarator[0].children
            .variableDeclaratorId[0].children.Identifier[0].image
      );
    const funcs = body
      .filter(
        (e) =>
          !!e.children.methodDeclaration ||
          !!e.children.interfaceMethodDeclaration
      )
      .map(
        (e) =>
          (e.children.methodDeclaration ||
            e.children.interfaceMethodDeclaration)[0].children.methodHeader[0]
            .children.methodDeclarator[0].children.Identifier[0].image
      );

    return {
      fields,
      funcs,
    };
  }
}

// read file by fs.readFileSync
// and fix some data of decompiled
// data because jd-cli and java-parser
// has a some bugs and java-parser
// throw error when see some
// data from jd-cli
function readBrokenJavaFile(path) {
  return (
    require("fs")
      .readFileSync(path)
      .toString()

      // java-parser throw
      // error when see ☃ symbol
      // so replace it
      .replaceAll("☃", "s")

      // change arrow function because in next
      // stages may has conflicts
      .replaceAll("  () ->", "()->")
      .replaceAll(" () ->", "()->")

      // java-parser don't like use null as
      // class property
      // example: some.null.test => some.n.test
      .replaceAll(".null.", ".n.")

      // jd-cli decompile
      // null arguments as '()' or ''
      // and java-parser throw error
      // when see this
      // example: func(3, (), "test", ()) ====> func(3, null, "test", null)
      .replaceAll("((),", "(null,")
      .replaceAll(", ()", ", null")
      .replaceAll("= ()", "= null")
      // example: execute(()) ====> execute(null)
      .replaceAll("(())", "(null)")
      // example: f(1, , 2) ====> f(1, 2)
      .replaceAll(", ,", ",")

      // java-parser don't like symbol \
      // but I cannot remove it because "\"" => """ (error)
      // so I try remove it by anther method
      .replaceAll('"\\\\\\\\"', '""')
      .replaceAll('"\\\\"', '""')
      .replaceAll('\\"', "l")
      .replaceAll("\\t", "t")

      // jd-cli after arrow function(()->{})
      // as argument of other function
      // don't add ',' so down replaceAll add it
      // bug: it "eat" 1 letter from next argument it's not big problem
      // example: func(() -> {}prop, "test") ====> func(() -> {},rop, "test")
      .replaceAll(/\s}"/g, '},"')
      .replaceAll(/}[A-z]/g, "},n")
      .replaceAll(/}[0-9]/g, "},1")
      .replaceAll(/}\(/g, "},(")
      .replaceAll(/}, \)/g, "} )")

      // java-parser don't like empty arrow function
      .replaceAll("-> ()", "-> {}")

      // java-parser don't like static {} declaration
      // example: static {System.out.println("Hello World!")} => (empty)
      .replaceAll(/\n  static {((.|\n)*)\n  }/g, "")

      // enum named Models have not elements
      // and java-parser don't like it so I add it
      .replaceAll("public enum Models {\n", "public enum Models {\n  Test();")
  );
}
