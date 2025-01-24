
vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: 'Miles_per_Gallon',
    [x, y]: vgx.brush({
        sides: vgx.dragLine(),
        top: vgx.text(
            [vgx.rect({ width: vgx.select('brush').data.percent * 50 }), vgx.rect({ width: 50 })]
        )
    }})
