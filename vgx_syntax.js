
console.log({
    data: data,
    x: 'Horsepower',
    y: 'Miles_per_Gallon',
    y: `vgx.brush({
        sides: vgx.dragLine(),
        top: vgx.text(
            [vgx.rect({ width: vgx.select('brush').data.percent * 50 }), vgx.rect({ width: 50 })]
        )`
})


vgx.scatterplot({
    data,
    x: ["Horsepower", "Miles_per_Gallon", vgx.brush()],
    ['x','y']: vgx.brush(),
    y: ["Miles_per_Gallon", "Horsepower", vgx.brush(), vgx.threshold({
        mark: [
            vgx.histogram({ data: vgx.threshold.above.data }),
            vgx.histogram({ data: vgx.threshold.below.data, height: -30 })
        ]
    })],
});

// 2x2 pairplot,
// with an x and a Y brush for data selection
// and each contain a threshold mark that displays a histogram of the data aboe, below threshold. 

// how do I specify, xy brush instead of x brush + y brush? 

vgx.barchart({
    x: vgx.sum(yield),
    y: 'variety',
    color: 'site',
    order: vgx.pointer()
})

vgx.barchart({
    x: vgx.sum(yield),
    y: 'variety',
    color: 'site',
    bind: {
        x: vgx.Grid({
            'order': vgx.Pointer()
        })
    }
})
// the x value that is clicked become the first one

// order selection -> if selected, move to high order, else could be set descending


// snap pointer to order (which for categorical is all of the values...)

//"what would it mean for you to pass in selection to order? I think it would imply that those  to "
// order is kinda a specila field, 


overview = vgx.areaplot({
    data: data,
    x: 'date',
    y: 'price',
    height: 100,
    bind: {
        x: vgx.Pointer({ name: 'filter' })
    }
})

detail = overview.clone({
    data: vgx.get("filter"),
    height: 500,
    bind: None,
})

overview.vconcat(detail)




overview = vgx.hist({ data: data, x: 'date', y: 'price', bind: { x: vgx.Threshold() } })
detail = overview.clone({ data: alx.Threshold.above, height: 50, bind: None })
overview.vconcat(detail)

// vgx.barchart({
//     x: vgx.sum(yield),
//     y:'variety',
//     color: vgx.pointer()
// })

//     //vgx.Order

//     marks: vgx.click({
//         bind:vgx.barchart.order(vgx.click.datum.variety)
//     })





// vgx.scatterplot({
//     x: 'Horsepower',
//     y: 'Miles_per_Gallon' + vgx.Brush()
// })

// vgx.scatterplot({
//     x: 'Horsepower',
//     y: encoding('Miles_per_Gallon').bind(
//         vgx.Brush({
//             sides: vgx.dragLine()
//         })
//     )
// });