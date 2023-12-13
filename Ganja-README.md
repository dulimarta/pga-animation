# Alternative way of using Ganja.js

## Installation

```
yarn add ganja.js
```

## Usage

Include it in your `.ts` file

```
// Use the default export
import Algebra from 'ganja.js'
const PGA2D = Algebra(2,0,1)
```

To list all the basis multivectors

```
console.debug(PGA2D.basis)
```
## Create Objects

Create a point at a given coordinate $(x,y)$ using one of the following techniques

```
const aPoint = new PGA2D()
// In PGA2D, points are grade 2
aPoint.nVector(2 /* grade */, -y, x, 1)
```

## Other functions

Given an object `X` created using

```
const X = new PGA2D()
```

The following functions can be called from `X`
using the `X.`_functionName_() syntax

| Name / Syntax                  | Description                                         |
|--------------------------------|-----------------------------------------------------|
| Add(Y)                         | Multivector addition                                |
| Coeff(_args_)                  | Set the multivector using the provided coefficients |
| Conjugate()                    | TBD                                                 |
| Dot()                          | Symmetric Contraction                               |
| Dual()                         | TBD                                                 |
| Even()                         | Select only even grade multivectors                 |
| Exp()                          | Exponentiation                                      |
| Grade(g)                       | Select only multivectors of the given grade         |
| Involute()                     | Return the involute of all the coefficient          |
| LDot()                         | Left contraction                                    |
| Length                         | TBD                                                 |
| Log()                          | Logarithm                                           |
| Mul(Y)                         | Geometric Product                                   |
| Negative()                     | Returns the negative of all the coefficients        |
| Normalized()                   | TBD                                                 |
| nVector(grade, _list_of_args_) | Set only a specific grade multivectors              |
| Reverse()                      | Return the reverse the coefficient                  |
| Scale(s)                       | MultiVector scalar multiplication                   |
| Sub(Y)                         | Multivector subtraction                             |
| toString()                     | Show the coefficient as a string                    |
| UnDual()                       | TBD                                                 |
| Vee()                          | Join (Dual of Wedge)                                |
| VLength()                      | TBD                                                 |
| Wedge()                        | Outer product                                       |