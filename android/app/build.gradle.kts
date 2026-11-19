import java.util.Properties

plugins {
    id("com.android.application")
}

// Upload-key settings live in android/keystore.properties (never committed)
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "kg.almart.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "kg.almart.app"
        minSdk = 24
        targetSdk = 36
        // Raise both for every release uploaded to Google Play
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        if (keystoreProps.getProperty("storeFile") != null) {
            create("upload") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("upload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Trusted Web Activity: opens https://tezbazar.vercel.app full-screen in Chrome
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
