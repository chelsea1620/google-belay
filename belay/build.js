({
    appDir: '../belay/',
    baseUrl: './',
    dir: '../built/belay',

    // TODO(jasvir): Turn on closure
    optimize: 'uglify',

    uglify: {
        gen_codeOptions: {},
        do_toplevel: {},
        ast_squeezeOptions: {}
    },

    // TODO(jasvir): Warn on style violations
    closure: {
        CompilerOptions: {},
        CompilationLevel: 'SIMPLE_OPTIMIZATIONS',
        loggingLevel: 'WARNING'
    },

    optimizeCss: 'standard',

    paths: {
        'jquery': 'lib/js/require-jquery',
        'require-jquery': 'lib/js/require-jquery'
    },

    useStrict: false,

    modules: [
        //Optimize the require-jquery.js
        {
            name: 'require-jquery'
        },

        //Optimize the application files. Exclude jQuery since it is
        //included already in require-jquery.js
        {
            name: 'index',
            exclude: ['jquery', 'belay-port.js']
        }
    ]
});
