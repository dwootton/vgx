
let vgx: any = {};
let data = {};
vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: 'Miles_per_Gallon'
}).bind(vgx.brush(), (brush) => {
    brush.sides.bind(vgx.dragline)
    brush.top.bind(vgx.text(brush.data.count))
    brush.top.bind(vgx.rect({ width: brush.data.percent * 50 }))
    brush.top.bind(vgx.rect({ width: 50 }))
})
vgx.scatterplot({ data: data, x: 'Horsepower', y: 'Miles_per_Gallon' }).y.bind(
    vgx.threshold(), (thresh) => {
        thresh.bind(vgx.histogram({ data: thresh.above.data }));
        thresh.bind(vgx.histogram({ data: thresh.below.data, height: -30 }));
    })

vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: ['Miles_per_Gallon',
        vgx.threshold({
            mark: [vgx.histogram({ data: vgx.select('threshold').above.data }),
            vgx.histogram({ data: vgx.select('threshold').below.data, height: -30 })]
        })
    ]
})

//merged syntax
vgx.scatterplot({ data: data, x: 'Horsepower', y: 'Miles_per_Gallon' }).y.bind(
    vgx.threshold({
        mark: [vgx.histogram({ data: vgx.select('threshold').above.data }),
        vgx.histogram({ data: vgx.select('threshold').below.data, height: -30 })]
    })
)

// brush with total indicator
vgx.scatterplot({ data: data, x: 'Horsepower', y: 'Miles_per_Gallon' }).bind(
    vgx.brush({
        sides: vgx.dragline(),
        top: [vgx.text({ text: vgx.select('brush').data.count }),
        vgx.rect({ width: vgx.select('brush').data.percent * 50 }),
        vgx.rect({ width: 50 })]
    }))



vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: 'Miles_per_Gallon',
    plot: vgx.brush({
        sides: vgx.drag_line(),
        top: [vgx.text({ 'text': vgx.select('brush').data.count }),
        vgx.rect({ width: vgx.select('brush').data.percent * 50 }),
        vgx.rect({ width: 50 })
        ]
    })
})
//Callback Syntax
vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: 'Miles_per_Gallon'
}).bind(vgx.brush(), (brush) => {
    brush.sides.bind(vgx.dragline())
    brush.top.bind(vgx.text({ text: brush.data.count }))
    brush.top.bind(vgx.rect({ width: brush.data.percent * 50 }))
    brush.top.bind(vgx.rect({ width: 50 }))
})



vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: {
        field: 'Miles_per_Gallon',
        binding: vgx.threshold({
            mark: [vgx.histogram({ data: vgx.select('threshold').above.data }),
            vgx.histogram({ data: vgx.select('threshold').below.data, height: -30 })]
        })
    }
})

vgx.scatterplot({
    data: data,
    x: 'Horsepower',
    y: 'Miles_per_Gallon',
    plot: vgx.brush({ // one downside is that now we need named arguments and can't have the default .bind
        sides: vgx.drag_line(),
        top: [vgx.text(vgx.select('brush').data.count),
        vgx.rect({ width: vgx.select('brush').data.percent * 50 }),
        vgx.rect({ width: 50 })
        ]
    })
})


vgx.scatterplot(
    vgx.brush({
        sides: vgx.dragLine(),
        top: vgx.text(
            [vgx.rect({ width: vgx.select('brush').data.percent * 50 }), vgx.rect({ width: 50 })]
        )
    })
)
vgx.scatterplot(
    vgx.brush({
        sides: vgx.dragLine(),
        top: vgx.text(
            [vgx.rect({ width: vgx.select('brush').data.percent * 50 }), vgx.rect({ width: 50 })]
        )
    }))



vgx.scatterplot(
    vgx.grid(
        vgx.brush({
            sides: vgx.dragLine(),
            top: vgx.select('brush').count.vis()
        })
    ))


vgx.brush({
    sides: vgx.dragLine(),
    top: vgx.text(
        [vgx.rect({ width: vgx.select('brush').data.percent * 50 }), vgx.rect({ width: 50 })]
    )
})