module.exports = {
    extends: ['stylelint-config-standard-scss'],
    plugins: ['stylelint-order'],
    customSyntax: 'postcss-html',
    rules: {
        'order/properties-order': [
            [
                'position',
                'top',
                'right',
                'bottom',
                'left',
                'z-index',

                'display',
                'flex',
                'flex-grow',
                'flex-shrink',
                'flex-direction',
                'justify-content',
                'align-items',
                'gap',

                'width',
                'height',
                'min-width',
                'min-height',
                'max-width',
                'max-height',

                'padding',
                'padding-top',
                'padding-right',
                'padding-bottom',
                'padding-left',

                'margin',
                'margin-top',
                'margin-right',
                'margin-bottom',
                'margin-left',

                'border',
                'border-radius',
                'box-shadow',

                'background',
                'background-color',

                'color',
                'font',
                'font-size',
                'font-weight',
                'line-height',
                'text-align',
                'text-decoration',

                'overflow',
                'visibility',
                'opacity',

                'transition',
                'animation',
            ],
            {
                unspecified: 'bottomAlphabetical',
            },
        ],
    },
};
