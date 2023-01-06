package me.peace.nashornapi;

import jdk.nashorn.api.scripting.JSObject;
import javax.script.Compilable;
import javax.script.CompiledScript;
import javax.script.ScriptEngineManager;
import javax.script.ScriptEngine;
import javax.script.Invocable;
import java.io.*;
import java.util.stream.Collectors;

public class Api {
	public static JSObject proxy;
	static {
		try {
			final ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
			final Compilable compilable = (Compilable)engine;
			final Invocable invocable = (Invocable)engine;
			final String jsonData = new BufferedReader(new InputStreamReader((new Api()).getClass()
				.getClassLoader()
				.getResourceAsStream("data.json"))).lines().collect(Collectors.joining(System.lineSeparator()));
			compilable.compile("{js}").eval();
			proxy = (JSObject)  invocable.invokeFunction("getProxy", jsonData);
		} catch (Exception e) {

		}
	}
}
