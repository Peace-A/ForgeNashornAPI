# ForgeNashornApi
Library for minecraft forge used for scripting by **nashorn** also can be used for CustomNPCs and Mappet.
Now officialy support only 1.12.2 version of minecraft yet.

# Example(version 1.12.2 script for Custom NPCs)
```javascript
// proxy has 2 methods create() and type()
var proxy = Java.type("me.peace.nashornapi.Api").getProxy()

function interact(e) {

  // e.npc.getMCEntity() = net.minecraft.entity.CreatureEntity
  
  // with ForgeNashornApi
  var entity = proxy.create(e.npc.getMCEntity())
  e.player.message( entity.shouldDespawnInPeaceful() )
  // or
  e.player.message( proxy.create(e.npc.getMCEntity()).shouldDespawnInPeaceful() )

  // without ForgeNashornApi
  e.player.message( e.npc.getMCEntity().func_225511_J_() )
  
  // type method is kind of Java.type but with decrypting
  // it don't see native methods (toString, so on)
  // so use it only for get static variables
  // in other situations use proxy.create
  
  // bad example because MAX_ENTITY_RADIUS is not encrypted
  e.player.message( proxy.type("net.minecraft.world.World").MAX_ENTITY_RADIUS )
}

```

# Build
  1. Download minecraft-forge-mdk
  2. Build project by `./gradlew build`
  3. Find in `~/.gradle/caches/**/** ` forge-VERSION-srg.jar and forge-VERSION_mapped_official.jar (naming of this files can have some changes)
  4. Download jd-cli
  5. Clone this repo
  6. `cd ForgeNashornApi`
  7. `mkdir build && cd build`
  8. `jd-cli forge-VERSION-srg.jar -od build/forgesrg`
  9. `jd-cli forge-VERSION_mapped_official.jar -od build/forgemap`
  10. Your `build` directory must has directories `forgesrg` and `forgemap` with decompiled data
  11. `pnpm install`
  12. `pnpm build` (note: you must choose right version of java by env JAVA_HOME, for 1.12.2 you must use java 8)
  13. Java-parser and jd-cli have some bugs so its can throw error so you must do some changes in selected .java file when it throw some
  14. build/ForgeNashornApi-VERSION.jar move to minecraft `mods` directory
  15. Remember delete build/cache.json if you change forgesrg or forgemap

# RoadMap
  - [ ] add support implements interfaces
  - [ ] fix bug with methods with same names
  - [ ] rewrite to java because java-parser and jd-cli have some bugs
